import { parseVndDigits } from "@/lib/format/vnd";
import type { ApiErrorBody, ErrorCode } from "./types";

/**
 * The browser transport, and the decode half of the API boundary.
 *
 * **Relative URLs only.** Every call goes to `/api/...`, which `next.config.ts` rewrites onto the
 * backend (ADR-0008). That is not tidiness: `manager_session` is `httpOnly` and host-only, so a
 * cross-origin request cannot carry it, and a browser that learned the backend's address could only
 * ever make unauthenticated calls. The browser is never given a base URL to get wrong.
 *
 * `decodeResponse`, `assertRelativePath`, `ApiError` and `GENERIC_ERROR_MESSAGE` are exported for
 * `server.ts` as well. One decode, two transports: the browser is the case that must not trust what
 * came back — anything between here and the backend can answer instead of the backend — and the
 * manager screens render in Server Components, so the guard below protects the money on screen only
 * if the server path uses it too.
 */

/**
 * The one message a 5xx is allowed to carry.
 *
 * `error-handler.ts:28-33` already replaces any unexpected fault with this line server-side, and
 * `AppError` messages are Vietnamese and written for the renter to read — which is why a 4xx message
 * is safe to render. This constant exists for the other direction: a fault that never reached the
 * error handler at all. A reverse proxy's 502 HTML, a load balancer's plain-text page, a `TypeError`
 * from `fetch` with the host in its `cause` — none of those are the contract, and none may become
 * text on a screen. So a 5xx message is replaced here regardless of what it said.
 */
export const GENERIC_ERROR_MESSAGE = "Đã xảy ra lỗi hệ thống";

/**
 * A failed API call, carrying the envelope's `code` rather than only its status.
 *
 * `code` is the branchable identifier (`shared/errors.ts:1-14`); `status` is incidental and two
 * codes share each of several statuses. `message` is the Vietnamese text from a 4xx envelope and is
 * safe to show; on a 5xx it is `GENERIC_ERROR_MESSAGE` whatever the body claimed.
 *
 * `status` is `0` when the request never reached a server — `fetch` rejected, the backend was down,
 * DNS failed. That is a distinct answer from any HTTP status and a screen can act on it.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Exhaustiveness check against `ErrorCode` and the only place an unrecognised code is rejected.
 *
 * `Record<ErrorCode, true>` rather than a `Set<string>` so that adding a code to the union fails
 * this file's typecheck until it is listed here. The membership test at `asErrorBody` is the only
 * runtime use: a code the contract does not have is drift, not a new case to pass through, so the
 * status-derived code answers instead.
 */
const STATUS_FOR_CODE: Record<ErrorCode, true> = {
  VALIDATION_ERROR: true,
  UNAUTHORIZED: true,
  MAGIC_LINK_EXPIRED: true,
  OTP_INVALID: true,
  OTP_EXPIRED: true,
  RATE_LIMITED: true,
  READING_CONFLICT: true,
  PERIOD_ALREADY_SENT: true,
  FORBIDDEN: true,
  NOT_FOUND: true,
  CONFLICT: true,
  EXTERNAL_SERVICE_ERROR: true,
  INTERNAL_ERROR: true,
};

/**
 * What to answer when the body is not our envelope at all — a 404 or a 502 from the proxy in front
 * of the app. The status is still true even though the body is someone else's, and a screen can
 * still route on it.
 */
const CODE_FOR_STATUS: Record<number, ErrorCode> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
};

/**
 * Every `VndString` key in `types.ts`, matched by name as a response is walked.
 *
 * `VndString` is `string`, so the compiler cannot tell an amount from a name at runtime, and the
 * response is untyped JSON until it is cast. This list is what makes that cast safe for money: each
 * key is checked for being a bare digit string and normalised, so `1.500.00` and `3500000₫` cannot
 * reach `formatVnd` and become an invoice that is out by a factor of a thousand.
 *
 * It is complete against `types.ts` today, and `fixtures.test.ts` fails if a new money field is added
 * to a fixture without being added here. It cannot notice a money field the backend invents and
 * nothing mirrors — that gap is closed by re-reading this list when a response type changes, which is
 * why every declaration above cites the backend line it came from.
 *
 * `accountNumber`, `idNumber` and every `name` are deliberately absent: a guard that reached for every
 * string would refuse a whole response over a person's name and take the screen down with it.
 */
const MONEY_KEYS: ReadonlySet<string> = new Set([
  "amount",
  "basePrice",
  "electricityPrice",
  "monthlyRent",
  "rentAmount",
  "electricityCost",
  "totalAmount",
  "waterCost",
  "waterPrice",
]);

/**
 * A site-relative path, enforced.
 *
 * `//host/path` is a protocol-relative URL, so a check for a leading slash alone would let it
 * through and send the session cross-origin; an absolute URL would fail the same way. Throwing here
 * turns a silent security regression into a stack trace naming the offending path.
 */
export function assertRelativePath(path: string): void {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(
      `lib/api: path must be site-relative and start with a single "/", got ${JSON.stringify(path)}. ` +
        `The browser reaches the backend through the /api/:path* rewrite in next.config.ts (ADR-0008); ` +
        `it is never given a host.`,
    );
  }
}

/**
 * `GET` a path the browser resolves against its own origin.
 *
 * `credentials: "same-origin"` is the default in every current browser, and it is written out because
 * this function's entire reason to exist is that the session cookie travels with it — a reader
 * should not have to know that to be sure.
 */
export async function apiGet<T>(path: string): Promise<T> {
  assertRelativePath(path);
  return decodeResponse<T>(await send(path, "GET"));
}

/**
 * `POST` / `PATCH` / `DELETE` a path, optionally with a body.
 *
 * A body-less call sends no `content-type` and no body at all. `DELETE` on a room
 * (`room.route.ts:130-141`) and on a motel takes nothing but the path, and a request with an empty
 * body is a 400 waiting to happen on someone else's server.
 *
 * `body === undefined` is the "no body" signal, never `JSON.stringify(undefined)` — which is the
 * `undefined` *string*, a body no endpoint accepts. A caller with a body it computed as
 * `undefined` therefore sends none, which is the honest reading of it.
 */
export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  assertRelativePath(path);
  return decodeResponse<T>(await send(path, method, body));
}

/**
 * One `fetch`, and the only place a network failure becomes an `ApiError`.
 *
 * A rejected `fetch` carries a `TypeError` whose `cause` can hold the host and port it tried; that
 * must not become an error message, so the cause is dropped and `status: 0` records what happened.
 */
async function send(path: string, method: string, body?: unknown): Promise<Response> {
  try {
    return await fetch(path, {
      method,
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        ...(body === undefined || body instanceof FormData ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, "INTERNAL_ERROR", GENERIC_ERROR_MESSAGE);
  }
}

/**
 * Turn a response into data or into an `ApiError`. Shared by both transports.
 *
 * The body is read as text exactly once, which is what makes an empty 204 (`room.route.ts:135-138`,
 * `auth.route.ts:68-71` return `""`) a `undefined` rather than a `SyntaxError` on `JSON.parse`.
 */
export async function decodeResponse<T>(res: Response): Promise<T> {
  const body = await readJson(res);
  if (!res.ok) throw errorFrom(res.status, body);
  if (body === undefined && res.status !== 204) {
    throw new ApiError(res.status, "INTERNAL_ERROR", GENERIC_ERROR_MESSAGE);
  }
  return guardMoney(body) as T;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.trim() === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // An HTML error page, or a proxy's plain text. A 2xx response with an unparseable body is
    // handled by `decodeResponse` (which throws for non-204 success); this function's job is only
    // to return `undefined` for an empty or unparseable body, and `errorFrom` decides what to do
    // with it on a non-2xx.
    return undefined;
  }
}

function errorFrom(status: number, body: unknown): ApiError {
  const envelope = asErrorBody(body);
  const code = envelope?.code ?? CODE_FOR_STATUS[status] ?? "INTERNAL_ERROR";

  // A 5xx is generic whatever it claimed: the fault that produced it is exactly the kind that
  // carries a driver message or a database URL, and `error-handler.ts` collapses it for that reason.
  // The code is kept, because a `502 EXTERNAL_SERVICE_ERROR` says something a manager can act on.
  const message = status >= 500 || envelope === null ? GENERIC_ERROR_MESSAGE : envelope.error;

  return new ApiError(status, code, message, envelope?.details);
}

/**
 * The envelope, or `null` if the body is not one — which is a fact, not an error.
 *
 * Both keys must be right, and the `code` must be one this build knows. A body claiming a code the
 * contract does not have is somebody else's body, so its `error` is not a message this app wrote for
 * a renter and is not rendered as one; the status-derived code answers instead.
 */
function asErrorBody(body: unknown): ApiErrorBody | null {
  if (typeof body !== "object" || body === null) return null;
  const { error, code } = body as Record<string, unknown>;
  if (typeof error !== "string" || typeof code !== "string") return null;
  if (STATUS_FOR_CODE[code as ErrorCode] === undefined) return null;
  const details = (body as Record<string, unknown>).details;
  return {
    error,
    code: code as ErrorCode,
    ...(details && typeof details === "object" && !Array.isArray(details)
      ? { details: details as Record<string, unknown> }
      : {}),
  };
}

/**
 * Walk a decoded response and gate every money field through `parseVndDigits` (D6).
 *
 * `VndString` is `string`, so a type annotation cannot check an amount — only this can, and it is
 * the difference between a manager seeing `1.500.00` rejected and one seeing a wrong invoice.
 *
 * Three rules, and each replaces a way this could go quietly wrong:
 *
 * - **A money field must be a string.** `typeof value === "string"` alone would let a JSON *number*
 *   through untouched, which is the exact drift `numeric(14,0)` returning a float is — and the value
 *   that reaches `formatVnd` would then be a `number` pretending to be digits.
 * - **A grouped amount is normalised, not rejected.** `3.500` is not a value the backend can send
 *   (`parseAmount` gates on `/^\d+$/`), so seeing one means something changed — but it is still
 *   correct, and normalising keeps `formatVndPlain` round-tripping through an editable field.
 * - **The value is rebuilt, not edited.** A guard that mutated the decoded body would surprise any
 *   caller holding the same object.
 *
 * A failure throws a plain `Error`, not an `ApiError`: nothing failed, the contract was broken. It
 * names the field path so the report is actionable, and it is not an `ApiError` so no screen mistakes
 * it for something the manager did.
 */
function guardMoney(node: unknown, path = ""): unknown {
  if (Array.isArray(node)) return node.map((item, index) => guardMoney(item, `${path}[${index}]`));
  if (typeof node !== "object" || node === null) return node;

  const guarded: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    const at = path === "" ? key : `${path}.${key}`;
    if (!MONEY_KEYS.has(key)) {
      guarded[key] = guardMoney(value, at);
      continue;
    }
    if (typeof value !== "string") {
      throw new Error(
        `lib/api: ${at} must be a string of digits on the wire, got ${JSON.stringify(value)} ` +
          `(${value === null ? "null" : typeof value}). A money field that arrives as a number is ` +
          `float money; see AGENTS.md and D6.`,
      );
    }
    const digits = parseVndDigits(value);
    if (digits === null) {
      throw new Error(
        `lib/api: ${at} is not a VND amount (${JSON.stringify(value)}). The backend only ever sends ` +
          `bare digits, so this is drift between the API and lib/api/types.ts.`,
      );
    }
    guarded[key] = digits;
  }
  return guarded;
}
