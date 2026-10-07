import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { rooms } from "@/modules/room/room.schema";
import { type VndString } from "@/shared/money";
import { contracts, contractTemplates } from "./contract.schema";

export async function listBillableContractsForMotel(motelId: string): Promise<Array<{ id: string; roomId: string; renterId: string; monthlyRent: VndString }>> {
  return db
    .select({ id: contracts.id, roomId: contracts.roomId, renterId: contracts.renterId, monthlyRent: contracts.monthlyRent })
    .from(contracts)
    .innerJoin(rooms, eq(contracts.roomId, rooms.id))
    .where(and(eq(rooms.motelId, motelId), eq(contracts.status, "active")))
    .orderBy(asc(contracts.roomId), asc(contracts.id));
}

export async function countContractTemplatesForMotel(motelId: string): Promise<number> {
  return db.$count(contractTemplates, eq(contractTemplates.motelId, motelId));
}

/**
 * Whether a room is tied down by a live contract.
 *
 * Only `active` counts: a draft, expired or terminated contract is history, and history does not
 * stop a room from being cleared out. Other modules ask this instead of reading `contracts`,
 * because a table is not an interface (ADR-0004).
 */
export async function hasActiveContractForRoom(roomId: string): Promise<boolean> {
  return (
    (await db.$count(contracts, and(eq(contracts.roomId, roomId), eq(contracts.status, "active")))) > 0
  );
}

export interface ActiveContractSummary {
  id: string;
  roomId: string;
  /** The room's display name, e.g. `P.101` — the only form a manager recognises it by. */
  roomName: string;
  /** `YYYY-MM-DD`. A `date` column is a calendar day, not an instant, so no timezone applies. */
  startDate: string;
  endDate: string;
  monthlyRent: VndString;
}

/**
 * The one live contract of a renter, with the room it is for.
 *
 * `null` is a normal answer, not a failure: a renter can be filed before a contract is written.
 *
 * **On reading `rooms` here.** `contract.schema.ts` already declares `contracts.room_id` as a
 * foreign key to `rooms.id`, so the reference is this module's own data — but a table is still
 * not an interface, so this is the one place that crosses the line ADR-0004 draws. It crosses
 * here rather than asking the room module because `room.service` imports this module; a lookup
 * exported from there and called back into this file would close an import cycle. The
 * alternative — a summary with no room name — is not something the manager can read.
 *
 * At most one row is expected: `contracts_room_active_uq` allows one active contract per room,
 * and a renter holding two in different rooms is corrupt data. The ordering is there so the
 * answer stays deterministic if that ever happens, rather than depending on scan order.
 */
export async function getActiveContractForRenter(
  renterId: string,
): Promise<ActiveContractSummary | null> {
  const [row] = await db
    .select({
      id: contracts.id,
      roomId: contracts.roomId,
      roomName: rooms.name,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      monthlyRent: contracts.monthlyRent,
    })
    .from(contracts)
    .innerJoin(rooms, eq(contracts.roomId, rooms.id))
    .where(and(eq(contracts.renterId, renterId), eq(contracts.status, "active")))
    .orderBy(desc(contracts.createdAt), desc(contracts.id))
    .limit(1);

  return row ?? null;
}