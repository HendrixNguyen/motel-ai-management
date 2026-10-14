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
 * `active` / `inactive` is a fact about the renter's tenancy, not about a room.
 *
 * `renters.roomId` is nullable while a renter has not been assigned a room and `status` defaults to
 * `active`, so the labels must not borrow the room vocabulary: "Đang ở" beside an empty Phòng cell
 * is false, and it collapses an occupied *room* and an active *tenancy* into one word when the two
 * are independent. `Đang thuê` / `Đã kết thức hợp đồng` name the tenancy itself — an active renter
 * whose contract has not started yet is still `Đang thuê`.
 */
const RENTER_STATUS_LABELS: Record<RenterStatus, string> = {
  active: "Đang thuê",
  inactive: "Đã kết thức hợp đồng",
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
