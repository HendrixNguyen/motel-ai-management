import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { rooms } from "@/modules/room/room.schema";
import { type VndString } from "@/shared/money";
import { contracts, contractTemplates } from "./contract.schema";
import { resolveOwnedMotel } from "@/middleware/tenancy";
import { AppError } from "@/shared/errors";
import type { ContractTemplateInput, ContractTemplateResponse, UpdateContractTemplateInput } from "./contract.types";

function templateResponse(row: typeof contractTemplates.$inferSelect): ContractTemplateResponse { return { ...row, createdAt: row.createdAt.toISOString() }; }
function validateTemplate(input: ContractTemplateInput | UpdateContractTemplateInput) { if (input.name !== undefined && !input.name.trim()) throw AppError.badRequest("Tên mẫu hợp đồng không được để trống"); if (input.clauses !== undefined && input.clauses.some((c) => !c.title.trim() || !c.content.trim())) throw AppError.badRequest("Điều khoản không được để trống"); }
async function clearDefault(motelId: string) { await db.update(contractTemplates).set({ isDefault: false }).where(and(eq(contractTemplates.motelId, motelId), eq(contractTemplates.isDefault, true))); }
export async function listContractTemplates(motelId: string, managerId: string) { await resolveOwnedMotel(motelId, managerId); const rows = await db.select().from(contractTemplates).where(eq(contractTemplates.motelId, motelId)).orderBy(asc(contractTemplates.createdAt), asc(contractTemplates.id)); return rows.map(templateResponse); }
export async function createContractTemplate(motelId: string, managerId: string, input: ContractTemplateInput) { await resolveOwnedMotel(motelId, managerId); validateTemplate(input); if (input.isDefault) await clearDefault(motelId); const [row] = await db.insert(contractTemplates).values({ motelId, name: input.name.trim(), clauses: input.clauses, isDefault: input.isDefault ?? false }).returning(); return templateResponse(row!); }
export async function getContractTemplate(motelId: string, templateId: string, managerId: string) { await resolveOwnedMotel(motelId, managerId); const row = await db.query.contractTemplates.findFirst({ where: and(eq(contractTemplates.id, templateId), eq(contractTemplates.motelId, motelId)) }); if (!row) throw AppError.notFound("Không tìm thấy mẫu hợp đồng"); return templateResponse(row); }
export async function updateContractTemplate(motelId: string, templateId: string, managerId: string, input: UpdateContractTemplateInput) { const current = await getContractTemplate(motelId, templateId, managerId); validateTemplate(input); if (input.isDefault) await clearDefault(motelId); const patch: Partial<typeof contractTemplates.$inferInsert> = {}; if (input.name !== undefined) patch.name = input.name.trim(); if (input.clauses !== undefined) patch.clauses = input.clauses; if (input.isDefault !== undefined) patch.isDefault = input.isDefault; if (!Object.keys(patch).length) return current; const [row] = await db.update(contractTemplates).set(patch).where(eq(contractTemplates.id, templateId)).returning(); return templateResponse(row!); }
export async function deleteContractTemplate(motelId: string, templateId: string, managerId: string) { await getContractTemplate(motelId, templateId, managerId); if (await db.$count(contracts, eq(contracts.templateId, templateId))) throw AppError.conflict("Không thể xóa mẫu hợp đồng đang được sử dụng"); await db.delete(contractTemplates).where(eq(contractTemplates.id, templateId)); }


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