import { ParseError, ValidationError } from "elysia";
import { AppError } from "@/shared/errors";

/**
 * Normalises anything thrown inside a route into the API contract's envelope.
 *
 * An `AppError` carries its own status and code, so the message is safe to show: it was
 * written in Vietnamese for the user. Anything else is logged in full and reported as a
 * generic failure, because a database URL or a driver message must never reach a client.
 */
const REDACTED = "[REDACTED]";
const SENSITIVE_QUERY_KEYS = new Set(["token", "access_token", "magic_link_token", "code", "secret", "key", "password"]);
const SENSITIVE_KEYS = new Set(["authorization", "token", "access_token", "magic_link_token", "code", "secret", "key", "password"]);

function normalizeKey(key: string): string {
  try { return decodeURIComponent(key).toLowerCase().replace(/[-.]/g, "_"); } catch { return key.toLowerCase().replace(/[-.]/g, "_"); }
}

function redactUrl(raw: string): string {
  try {
    const relative = raw.startsWith("/");
    const url = new URL(raw, "http://redact.invalid");
    const path = url.pathname.replace(/(^|\/)r\/[^/]+(?=\/|$)/gi, `$1r/${REDACTED}`);
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEYS.has(normalizeKey(key))) url.searchParams.set(key, REDACTED);
    }
    url.pathname = path;
    return relative ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch {
    return raw.replace(/(^|\/)r\/[^/\s?#]+/gi, `$1r/${REDACTED}`)
      .replace(/([?&](?:token|access_token|magic[_-]link[_-]token|code|secret|key|password)=)[^&#\s]*/gi, `$1${REDACTED}`);
  }
}

export function redactSecrets(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEYS.has(normalizeKey(key))) return REDACTED;
  if (typeof value === "string") {
    return value
      .replace(/https?:\/\/[^\s]+/gi, (url) => redactUrl(url))
      .replace(/(^|\/)r\/[^/\s?#]+/gi, `$1r/${REDACTED}`)
      .replace(/\/[^\s?#]*\?[^\s#]*/g, (url) => redactUrl(url))
      .replace(/((?:^|\s)(?:token|access_token|magic[_-]?link[_-]?token|code|secret|key|password)=)[^\s&#]*/gi, `$1${REDACTED}`)
      .replace(/(Bearer\s+)[^\s]+/gi, `$1${REDACTED}`);
  }
  if (value instanceof Error) return { name: value.name, message: redactSecrets(value.message), stack: redactSecrets(value.stack) };
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redactSecrets(entryValue, entryKey)]));
  return value;
}

export function errorHandler({ error, request, set }: { error: unknown; request?: Request; set: any }) {
  if (error instanceof AppError) {
    set.status = error.status;
    return error.details
      ? { error: error.message, code: error.code, details: error.details }
      : { error: error.message, code: error.code };
  }

  // Elysia rejects a body that fails `t.Object(...)` before the handler ever runs. Without
  // this branch the caller gets a 500 for a plain 400, and the reason is thrown away with the
  // validator. The validator's own text stays server-side: it carries the schema, and the
  // contract asks for a Vietnamese message.
  if (error instanceof ValidationError || error instanceof ParseError) {
    set.status = 400;
    return { error: "Dữ liệu gửi lên không hợp lệ", code: "VALIDATION_ERROR" };
  }

  console.error("Unhandled error:", redactSecrets(error), request ? redactSecrets(request.url) : undefined);
  set.status = 500;
  return {
    error: "Đã xảy ra lỗi hệ thống",
    code: "INTERNAL_ERROR",
  };
}