import { serverGet } from "./server";
import type { MotelResponse } from "./types";

/**
 * Motel reads. Server Components only — see `motels.client.ts` for the mutations and `server.ts`
 * for why the split exists.
 *
 * The base path lives here, once. No screen assembles `/api/manager/motels`, because a screen that
 * does is one rename away from asking for a resource that no longer exists, with no type to stop it.
 */

/** `GET /api/manager/motels` — `motel.route.ts:36`. */
const MOTELS = "/api/manager/motels";

/**
 * Every motel the signed-in manager owns — `motel.service.ts:45` returns the array itself, with no
 * envelope and no pagination, so a screen written against `{ motels: [...] }` would find nothing at
 * runtime with nothing at compile time to catch it.
 */
export function listMotels(): Promise<MotelResponse[]> {
  return serverGet<MotelResponse[]>(MOTELS);
}

/**
 * `GET /api/manager/motels/:motelId` — `motel.route.ts:61`.
 *
 * A motel belonging to another manager is a 404, never a 403 (`AGENTS.md`): a 403 would confirm the
 * resource exists.
 */
export function getMotel(motelId: string): Promise<MotelResponse> {
  return serverGet<MotelResponse>(`${MOTELS}/${encodeURIComponent(motelId)}`);
}
