import { apiSend } from "./client";
import type { CreateRoomInput, RoomResponse, UpdateRoomInput } from "./types";

/**
 * Room mutations, in the browser. See `motels.client.ts` for why these are split out and why no
 * money validation happens here.
 */

/** `POST /api/manager/motels/:motelId/rooms` — `room.route.ts:96`. */
const ROOMS = (motelId: string): string =>
  `/api/manager/motels/${encodeURIComponent(motelId)}/rooms`;

/**
 * Creates a room and answers 201 with it.
 *
 * `409` on a duplicate `(motelId, name)` — `room.service.ts:154` answers
 * `Phòng "P.101" đã tồn tại trong nhà trọ này`, which D8 renders as a form-level banner because the
 * envelope carries no field names to attach the message to.
 */
export function createRoom(motelId: string, input: CreateRoomInput): Promise<RoomResponse> {
  return apiSend<RoomResponse>(ROOMS(motelId), "POST", input);
}

/** Patches a room — `room.route.ts:118`. Only the keys present are sent. */
export function updateRoom(
  motelId: string,
  roomId: string,
  input: UpdateRoomInput,
): Promise<RoomResponse> {
  return apiSend<RoomResponse>(`${ROOMS(motelId)}/${encodeURIComponent(roomId)}`, "PATCH", input);
}

/**
 * Deletes a room — `room.route.ts:130`. Answers 204, so this resolves `undefined`.
 *
 * `409` in two cases, both from `room.service.ts:222-233`: a live contract holds the room
 * (`Phòng đang có hợp đồng hiệu lực…`) or a renter is still assigned to it (`Còn N người thuê trong
 * phòng…`). Nothing cascades, so a screen offering this button has to handle a failure and not only a
 * success.
 */
export function deleteRoom(motelId: string, roomId: string): Promise<void> {
  return apiSend<void>(`${ROOMS(motelId)}/${encodeURIComponent(roomId)}`, "DELETE");
}
