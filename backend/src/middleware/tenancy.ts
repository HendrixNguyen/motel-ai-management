import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { AppError } from "@/shared/errors";

export type MotelRow = typeof motels.$inferSelect;
export type RoomRow = typeof rooms.$inferSelect;

export async function resolveOwnedMotel(
  motelId: string,
  managerId: string,
): Promise<MotelRow> {
  const row = await db.query.motels.findFirst({
    where: and(eq(motels.id, motelId), eq(motels.managerId, managerId)),
  });
  if (!row) {
    throw AppError.notFound("Không tìm thấy nhà trọ");
  }
  return row;
}

/**
 * Proves a room sits inside a motel the caller already owns.
 *
 * The renter module needs this and cannot get it from the room module: `room.service` already
 * imports `renter.service`, so importing a room lookup back out of it would close an import
 * cycle. The tenancy seam is where a tenant-scoped existence check belongs — it already reads
 * `motels` straight from the table for the same reason — so the `rooms` table is read here and
 * nowhere else outside the modules that own it (ADR-0004).
 *
 * 404, never 403: a room in another motel has to be indistinguishable from a room that does not
 * exist, because a 403 would confirm the id the caller guessed is real.
 */
export async function resolveRenterInMotel(renterId: string, motelId: string) {
  const row = await db.query.renters.findFirst({
    where: and(eq(renters.id, renterId), eq(renters.motelId, motelId)),
  });
  if (!row) throw AppError.notFound("Không tìm thấy người thuê");
  return row;
}

export async function resolveRoomInMotel(
  roomId: string,
  motelId: string,
): Promise<RoomRow> {
  const row = await db.query.rooms.findFirst({
    where: and(eq(rooms.id, roomId), eq(rooms.motelId, motelId)),
  });
  if (!row) {
    throw AppError.notFound("Không tìm thấy phòng");
  }
  return row;
}
