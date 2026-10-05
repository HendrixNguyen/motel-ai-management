import { serverGet } from "./server";
import type { ManagerMeResponse } from "./types";

/**
 * The signed-in manager's identity — `GET /api/auth/me` (`auth.route.ts:73-83`), read in a Server
 * Component so the shell can refuse to render for a session that has ended.
 *
 * The answer is `{ id, email }` and **no name**: `/me` reads the claims off the JWT, which never
 * carried one. That is why `ManagerMeResponse` is not `ManagerAuthResponse` with an optional field,
 * and why the top bar shows an email. A screen that reaches for `me.name` gets `undefined`, which is
 * the failure the two separate types exist to make impossible to compile.
 */
export function getMe(): Promise<ManagerMeResponse> {
  return serverGet<ManagerMeResponse>("/api/auth/me");
}
