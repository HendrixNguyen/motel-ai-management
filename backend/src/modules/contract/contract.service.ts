import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts, contractTemplates } from "./contract.schema";

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
