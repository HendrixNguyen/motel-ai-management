import { asc, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, type DbExecutor, type DbTransaction } from "@/db";
import { resolveAccessibleMotel, type MotelActor, type MotelRow } from "@/middleware/tenancy";
import { AppError } from "@/shared/errors";
import { parseAmount } from "@/shared/money";
import { countBillingPeriodsForMotel } from "@/modules/billing/billing.service";
import { countContractTemplatesForMotel } from "@/modules/contract/contract.service";
import { countRentersForMotel } from "@/modules/renter/renter.service";
import { countOccupiedRoomsForMotel, countRoomsForMotel } from "@/modules/room/room.service";
import {
  assertEnabledManager,
  listManagerDisplayNames,
} from "@/modules/auth/admin-account.service";
import { motels, type BankAccount, type MotelFee } from "./motel.schema";
import type {
  CreateMotelInput,
  MotelFeeInput,
  MotelResponse,
  UpdateMotelInput,
} from "./motel.types";

type MotelPatch = Partial<{
  name: string;
  address: string | null;
  electricityPrice: string;
  waterPrice: string;
  otherFees: MotelFee[];
  bankAccount: BankAccount | null;
}>;

function toFees(fees: MotelFeeInput[]): MotelFee[] {
  return fees.map((fee) => ({ name: fee.name, amount: parseAmount(fee.amount) }));
}

/**
 * The contract asks for ISO-8601 UTC timestamps on the wire, and the row holds a `Date`. Rendering
 * it here is what makes `MotelResponse.createdAt: string` a compile-time fact rather than a claim
 * that happens to be true because `JSON.stringify` formats a `Date` the same way.
 */
function toResponse(row: MotelRow, managerName?: string): MotelResponse {
  return {
    ...row,
    ...(managerName ? { managerName } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

export interface RenterMotelProjection {
  id: string;
  name: string;
  bankAccount: BankAccount | null;
}

export interface PublicRecoveryMotel {
  id: string;
  managerId: string;
  publicAccessCode: string;
}

export async function findMotelByPublicAccessCode(
  code: string,
): Promise<PublicRecoveryMotel | null> {
  const row = await db.query.motels.findFirst({
    where: eq(motels.publicAccessCode, code),
    columns: { id: true, managerId: true, publicAccessCode: true },
  });
  return row ?? null;
}

export async function getMotelPublicAccessCode(
  motelId: string,
  actor: MotelActor,
): Promise<string> {
  const motel = await resolveAccessibleMotel(motelId, actor);
  return motel.publicAccessCode;
}

export async function getMotelForRenter(motelId: string): Promise<RenterMotelProjection | null> {
  const row = await db.query.motels.findFirst({
    where: eq(motels.id, motelId),
    columns: { id: true, name: true, bankAccount: true },
  });
  return row ?? null;
}

export async function listMotels(actor: MotelActor): Promise<MotelResponse[]> {
  const rows = await db.query.motels.findMany({
    where: actor.role === "manager" ? eq(motels.managerId, actor.userId) : undefined,
    orderBy: [asc(motels.createdAt), asc(motels.id)],
  });
  const names = await listManagerDisplayNames([...new Set(rows.map((row) => row.managerId))]);
  return rows.map((row) => toResponse(row, names.get(row.managerId)));
}

export async function lockMotelForUpdate(tx: DbTransaction, motelId: string): Promise<void> {
  await tx.execute(sql`SELECT id FROM ${motels} WHERE id = ${motelId} FOR UPDATE`);
}

export async function lockMotelSetup(tx: DbTransaction, managerId: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('motel_setup:' || ${managerId}))`);
}

export async function createMotelInTransaction(
  tx: DbExecutor,
  ownerManagerId: string,
  input: CreateMotelInput,
): Promise<MotelResponse> {
  await assertEnabledManager(tx, ownerManagerId);
  const managerName = (await listManagerDisplayNames([ownerManagerId], tx)).get(ownerManagerId);
  const [row] = await tx
    .insert(motels)
    .values({
      managerId: ownerManagerId,
      publicAccessCode: randomBytes(24).toString("base64url"),
      name: input.name,
      address: input.address ?? null,
      electricityPrice: parseAmount(input.electricityPrice),
      waterPrice: parseAmount(input.waterPrice),
      otherFees: input.otherFees === undefined ? [] : toFees(input.otherFees),
      bankAccount: input.bankAccount ?? null,
    })
    .returning();
  return toResponse(row!, managerName);
}

export function resolveOwnerManagerId(actor: MotelActor, requestedOwnerId?: string): string {
  if (actor.role === "manager") {
    if (requestedOwnerId !== undefined)
      throw AppError.badRequest("Quản lý không được chỉ định chủ sở hữu nhà trọ");
    return actor.userId;
  }
  if (!requestedOwnerId)
    throw AppError.badRequest("Vui lòng chọn tài khoản quản lý sở hữu nhà trọ");
  return requestedOwnerId;
}

export async function createMotel(
  actor: MotelActor,
  input: CreateMotelInput,
): Promise<MotelResponse> {
  return db.transaction(async (tx) => {
    const ownerManagerId = resolveOwnerManagerId(actor, input.ownerManagerId);
    await lockMotelSetup(tx, ownerManagerId);
    await assertEnabledManager(tx, ownerManagerId);
    const motelCount = await tx.$count(motels, eq(motels.managerId, ownerManagerId));
    if (motelCount === 0) {
      throw new AppError(
        "MOTEL_SETUP_REQUIRED",
        "Chưa có nhà trọ nào. Vui lòng thiết lập đầy đủ thông tin nhà trọ đầu tiên.",
      );
    }
    return createMotelInTransaction(tx, ownerManagerId, input);
  });
}

export async function getMotel(motelId: string, actor: MotelActor): Promise<MotelResponse> {
  const motel = await resolveAccessibleMotel(motelId, actor);
  const managerName = (await listManagerDisplayNames([motel.managerId])).get(motel.managerId);
  return toResponse(motel, managerName);
}

/**
 * A true partial update: a key absent from the body is absent from the patch, so an
 * `undefined` can never overwrite a stored value. An explicit `otherFees: []` or
 * `bankAccount: null` is the only way to clear those two.
 */
export async function updateMotel(
  motelId: string,
  actor: MotelActor,
  input: UpdateMotelInput,
): Promise<MotelResponse> {
  const owned = await resolveAccessibleMotel(motelId, actor);

  const patch: MotelPatch = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.address !== undefined) patch.address = input.address;
  if (input.electricityPrice !== undefined)
    patch.electricityPrice = parseAmount(input.electricityPrice);
  if (input.waterPrice !== undefined) patch.waterPrice = parseAmount(input.waterPrice);
  if (input.otherFees !== undefined) patch.otherFees = toFees(input.otherFees);
  if (input.bankAccount !== undefined) patch.bankAccount = input.bankAccount;

  // `update ... set` with no columns is a syntax error, and `{}` is a legal request.
  const managerName = (await listManagerDisplayNames([owned.managerId])).get(owned.managerId);
  if (Object.keys(patch).length === 0) return toResponse(owned, managerName);

  const [row] = await db.update(motels).set(patch).where(eq(motels.id, motelId)).returning();
  return toResponse(row!, managerName);
}

/**
 * Deleting a motel is refused while anything still points at it.
 *
 * Every foreign key in this schema is `ON DELETE no action`, so a delete that had dependents
 * would raise a constraint violation the error handler reports as a 500 — an internal detail
 * dressed up as a server fault. The counts turn that into a 409 the manager can read, and
 * nothing is ever cascaded away silently: financial history that reached an invoice stays.
 *
 * The counts come from the owning modules' services, never from their tables (ADR-0004).
 */
export async function deleteMotel(motelId: string, actor: MotelActor): Promise<void> {
  await db.transaction(async (tx) => {
    const motel = await resolveAccessibleMotel(motelId, actor, tx);
    await lockMotelSetup(tx, motel.managerId);
    await resolveAccessibleMotel(motelId, actor, tx);

    const occupiedRooms = await countOccupiedRoomsForMotel(motelId);
    if (occupiedRooms > 0) {
      throw AppError.conflict(
        `Còn ${occupiedRooms} phòng đang có người thuê. Hãy chuyển phòng về trống trước khi xóa nhà trọ.`,
      );
    }

    const rooms = await countRoomsForMotel(motelId);
    if (rooms > 0) {
      throw AppError.conflict(`Còn ${rooms} phòng. Hãy xóa hết phòng trước khi xóa nhà trọ.`);
    }

    const renters = await countRentersForMotel(motelId);
    if (renters > 0) {
      throw AppError.conflict(
        `Còn ${renters} người thuê. Hãy xóa người thuê trước khi xóa nhà trọ.`,
      );
    }

    const billingPeriods = await countBillingPeriodsForMotel(motelId);
    if (billingPeriods > 0) {
      throw AppError.conflict(
        `Còn ${billingPeriods} kỳ thanh toán. Hãy xóa kỳ thanh toán trước khi xóa nhà trọ.`,
      );
    }

    const contractTemplates = await countContractTemplatesForMotel(motelId);
    if (contractTemplates > 0) {
      throw AppError.conflict(
        `Còn ${contractTemplates} mẫu hợp đồng. Hãy xóa mẫu hợp đồng trước khi xóa nhà trọ.`,
      );
    }

    await tx.delete(motels).where(eq(motels.id, motelId));
  });
}
