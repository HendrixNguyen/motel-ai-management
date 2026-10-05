import { apiSend } from "./client";
import type { LoginInput, ManagerAuthResponse, RegisterManagerInput } from "./types";

/**
 * The three auth calls that must be made **by the browser**.
 *
 * All three set or clear `manager_session` on their response (`auth.route.ts:23-29`, `:48-55`,
 * `:68-70`), and the cookie is `httpOnly`, `sameSite: "lax"` and `secure` in production. A Server
 * Action could make the same request, but the `Set-Cookie` would arrive as a header on the action's
 * own response and would have to be forwarded by hand — every attribute of it retyped by hand, once,
 * with no test between the retyping and the browser. A relative browser POST through the rewrite
 * proxy lets the backend's own header do the work unchanged, which is the smaller mechanism and the
 * one D3 chose.
 *
 * So: these three go to `/api/...` and the browser sets the cookie itself. `getMe` is the odd one
 * out — it is a read with no `Set-Cookie`, and it lives in `auth.ts` on the server side.
 */

/** `POST /api/auth/register` — `auth.route.ts:18`. Answers 201 with the manager. */
export function register(input: RegisterManagerInput): Promise<ManagerAuthResponse> {
  return apiSend<ManagerAuthResponse>("/api/auth/register", "POST", input);
}

/**
 * `POST /api/auth/login` — `auth.route.ts:43`.
 *
 * A wrong email or password is a `400 VALIDATION_ERROR` whose message is Vietnamese and safe to
 * render (`auth.service.ts`). Rate limiting is per IP and per email, and answers `429 RATE_LIMITED`.
 */
export function login(input: LoginInput): Promise<ManagerAuthResponse> {
  return apiSend<ManagerAuthResponse>("/api/auth/login", "POST", input);
}

/**
 * `POST /api/auth/logout` — `auth.route.ts:65`. Answers 204 with no body, so this resolves
 * `undefined`, and the browser drops the cookie because the backend cleared it.
 */
export function logout(): Promise<void> {
  return apiSend<void>("/api/auth/logout", "POST");
}
