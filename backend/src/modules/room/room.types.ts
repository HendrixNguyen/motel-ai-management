import { type VndString } from "@/shared/money";
import { roomStatus } from "./room.schema";

/**
 * A VND amount on the wire. Always a JSON string of digits (`"3850000"`), never a number.
 *
 * Re-exported from `shared/money` rather than redeclared: every module that carries VND over HTTP
 * names the same alias, and one home for it is one place it cannot drift from.
 *
 * `RoomResponse` declares `basePrice` as `VndString`, so returning a row whose `basePrice` is
 * anything but a string stops compiling.
 */
export type { VndString };

export type RoomStatus = (typeof roomStatus.enumValues)[number];

export interface CreateRoomInput {
  name: string;
  /** VND, whole units. */
  basePrice: VndString;
  floor?: number | null;
  status?: RoomStatus;
}

/** Every key optional; a key absent from the body is never written. */
export interface UpdateRoomInput {
  name?: string;
  basePrice?: VndString;
  floor?: number | null;
  status?: RoomStatus;
}

export interface ListRoomsFilters {
  floor?: number;
  status?: RoomStatus;
  search?: string;
}

export interface RoomResponse {
  id: string;
  motelId: string;
  name: string;
  basePrice: VndString;
  floor: number | null;
  status: RoomStatus;
  /** ISO-8601 UTC string on the wire, as the contract asks. */
  createdAt: string;
}