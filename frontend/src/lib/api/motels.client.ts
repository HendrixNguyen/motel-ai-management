import { apiSend } from "./client";
import type { CreateMotelInput, MotelResponse, UpdateMotelInput } from "./types";

/**
 * Motel mutations, in the browser.
 *
 * D3 puts every write in a client component that POSTs to the proxied path, so these call the
 * relative `/api/...` and let the rewrite proxy carry the request — the `httpOnly` session cookie
 * goes with it because the request never leaves the origin. The filename suffix says which half of
 * the pair this is: `motels.ts` imports `server.ts`, which is marked `server-only`, so a client
 * component may import this file and must not import that one.
 *
 * There is deliberately no money validation here. `parseVndDigits` is the gate on the way *in*
 * (`client.ts`), and `vnd.ts:50-51` assigns the submit-side check to the editable field, where a
 * rejected amount can be reported against the input the manager typed it into. A throw from here
 * would arrive with no field attached, which is a worse answer than the field's own message.
 */

/** `POST /api/manager/motels` — `motel.route.ts:39`. */
const MOTELS = "/api/manager/motels";

/** Creates a motel and answers 201 with it (`motel.route.ts:39-58`). */
export function createMotel(input: CreateMotelInput): Promise<MotelResponse> {
  return apiSend<MotelResponse>(MOTELS, "POST", input);
}

/**
 * Patches a motel — `motel.route.ts:69-86`.
 *
 * Only the keys present in `input` are sent, so a field the manager did not touch cannot be cleared:
 * `motel.service.ts` writes field by field and an explicit `null` is the only way to clear a value.
 */
export function updateMotel(motelId: string, input: UpdateMotelInput): Promise<MotelResponse> {
  return apiSend<MotelResponse>(`${MOTELS}/${encodeURIComponent(motelId)}`, "PATCH", input);
}

/**
 * Deletes a motel — `motel.route.ts:88`. Answers 204, so this resolves `undefined`.
 *
 * `409` while any room is occupied, which the caller shows as a message rather than a crash.
 */
export function deleteMotel(motelId: string): Promise<void> {
  return apiSend<void>(`${MOTELS}/${encodeURIComponent(motelId)}`, "DELETE");
}
