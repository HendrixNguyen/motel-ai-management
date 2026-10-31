import { serverGet } from "./server";
import type { MotelResponse } from "./types";

/**
 * Motel reads. Server Components only — see `motels.client.ts` for the mutations and `server.ts`
 * for why the split exists.
 *
 * The base path is declared in both `motels.ts` and `motels.client.ts`. The duplication is
 * deliberate: the read side imports `server.ts`, which carries `import "server-only"`, so a shared
 * constant module would have to be imported by both sides. Moving it into a module either side can
 * reach without pulling `server-only` in is more indirection than one literal earns.
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
