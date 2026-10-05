import { serverGet } from "./server";
import type { ListRoomsFilters, RoomResponse } from "./types";

/**
 * Room reads. Server Components only — the mutations are in `rooms.client.ts`.
 *
 * Every filter is `?`-encoded by `URLSearchParams`, which is the part that matters for a Vietnamese
 * name: a hand-built `?search=${term}` sends raw UTF-8 that some proxies mangle, and a room or a
 * renter's name is the one field guaranteed to carry diacritics.
 */

/** `GET /api/manager/motels/:motelId/rooms` — `room.route.ts:82`. */
const ROOMS = (motelId: string): string =>
  `/api/manager/motels/${encodeURIComponent(motelId)}/rooms`;

/**
 * The rooms of one motel — `room.service.ts:106` returns a bare array, no envelope, no pagination.
 *
 * A filter absent from `filters` is not sent, and a filter set to `""` is not sent either:
 * `room.service.ts:117-119` treats an empty `?search=` as no filter on purpose, so sending one is
 * noise — and a manager who cleared the search box asked for the whole list. `floor: 0` *is* sent:
 * the service filters on `!== undefined` (`:114`), so a truthiness test on the way out would answer
 * with every floor.
 */
export function listRooms(motelId: string, filters: ListRoomsFilters = {}): Promise<RoomResponse[]> {
  const query = new URLSearchParams();
  if (filters.floor !== undefined) query.set("floor", String(filters.floor));
  if (filters.status !== undefined) query.set("status", filters.status);
  if (filters.search !== undefined && filters.search !== "") query.set("search", filters.search);

  const search = query.toString();
  return serverGet<RoomResponse[]>(search === "" ? ROOMS(motelId) : `${ROOMS(motelId)}?${search}`);
}

/** `GET /api/manager/motels/:motelId/rooms/:roomId` — `room.route.ts:110`. */
export function getRoom(motelId: string, roomId: string): Promise<RoomResponse> {
  return serverGet<RoomResponse>(
    `${ROOMS(motelId)}/${encodeURIComponent(roomId)}`,
  );
}
