import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { renters } from "./renter.schema";
import { magicLinks } from "@/modules/auth/auth.schema";
import { AppError } from "@/shared/errors";
import { normalisePhone } from "@/shared/phone";

export type RenterRow = typeof renters.$inferSelect;

export async function getRenter(renterId: string): Promise<RenterRow | undefined> {
  return db.query.renters.findFirst({ where: eq(renters.id, renterId) });
}

export async function createRenter(input: {
  motelId: string;
  name: string;
  phone: string;
  roomId?: string;
}): Promise<RenterRow> {
  const phone = normalisePhone(input.phone);
  const [row] = await db
    .insert(renters)
    .values({ ...input, phone })
    .returning();
  return row!;
}

export async function getRenterByPhone(motelId: string, phone: string): Promise<RenterRow | undefined> {
  const normalizedPhone = normalisePhone(phone);
  return db.query.renters.findFirst({
    where: and(eq(renters.motelId, motelId), eq(renters.phone, normalizedPhone)),
  });
}

export async function countRentersForMotel(motelId: string): Promise<number> {
  return db.$count(renters, eq(renters.motelId, motelId));
}

/**
 * Renters still assigned to a room, whatever their status.
 *
 * The status is deliberately absent from the filter. `renters.room_id` is a foreign key with
 * `ON DELETE no action`, so an `inactive` renter left pointing at a room blocks its deletion
 * exactly as much as an active one — counting only the active rows would let the delete through
 * and turn a refusal the manager can read into a 500.
 */
export async function countRentersInRoom(roomId: string): Promise<number> {
  return db.$count(renters, eq(renters.roomId, roomId));
}
