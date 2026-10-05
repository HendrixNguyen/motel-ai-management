/**
 * Vietnamese label for a `room_status` value — the PostgreSQL enum in
 * `backend/src/modules/room/room.schema.ts`, hand-written here because the frontend tsconfig does
 * not resolve the backend's alias (D7).
 */
export type RoomStatus = "available" | "occupied" | "maintenance";

/** A `renter_status` value (`backend/src/modules/renter/renter.schema.ts`). */
export type RenterStatus = "active" | "inactive";

/**
 * `Record<RoomStatus, string>` rather than a plain object: adding a value to the enum above fails
 * the typecheck until it has a label, so an unmapped status cannot reach a screen and throw there.
 *
 * The words are the spec's, not mine: `Trống` / `Đang ở` / `Bảo trì` are the room status vocabulary
 * in `docs/frontend-ui-specs.md` (M3).
 */
const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  available: "Trống",
  occupied: "Đang ở",
  maintenance: "Bảo trì",
};

/**
 * A renter row is `active` while the person is still staying, `inactive` once they have left.
 * `Đang ở` is deliberately the same word as an occupied room (M3), so one screen never shows two
 * vocabularies for "still here".
 */
const RENTER_STATUS_LABELS: Record<RenterStatus, string> = {
  active: "Đang ở",
  inactive: "Đã chuyển đi",
};

export function roomStatusLabel(status: RoomStatus): string {
  return ROOM_STATUS_LABELS[status];
}

export function renterStatusLabel(status: RenterStatus): string {
  return RENTER_STATUS_LABELS[status];
}

/**
 * Whether the renter follows the Zalo OA — the `Trạng thái Zalo OA` column in M4, and the switch
 * behind the portal's follow-the-OA banner. A separate vocabulary from the renter's own status: a
 * renter who has never followed is still `active`.
 */
export function oaFollowerLabel(isOaFollower: boolean): string {
  return isOaFollower ? "Đã follow" : "Chưa follow";
}
