import { ParseError, ValidationError } from "elysia";
import { AppError } from "@/shared/errors";

/**
 * Normalises anything thrown inside a route into the API contract's envelope.
 *
 * An `AppError` carries its own status and code, so the message is safe to show: it was
 * written in Vietnamese for the user. Anything else is logged in full and reported as a
 * generic failure, because a database URL or a driver message must never reach a client.
 */
function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/((?:[?&]|\b)(?:token|magic[_-]?link|code|secret|key|password)=)[^&#\s]*/gi, "$1[REDACTED]")
      .replace(/(Bearer\s+)[^\s]+/gi, "$1[REDACTED]");
  }
  if (value instanceof Error) return { name: value.name, message: redactSecrets(value.message), stack: redactSecrets(value.stack) };
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