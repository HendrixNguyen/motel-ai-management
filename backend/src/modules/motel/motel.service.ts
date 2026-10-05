import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { resolveOwnedMotel, type MotelRow } from "@/middleware/tenancy";
import { AppError } from "@/shared/errors";
import { parseAmount } from "@/shared/money";
import { countBillingPeriodsForMotel } from "@/modules/billing/billing.service";
import { countContractTemplatesForMotel } from "@/modules/contract/contract.service";
import { countRentersForMotel } from "@/modules/renter/renter.service";
import { countOccupiedRoomsForMotel, countRoomsForMotel } from "@/modules/room/room.service";
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
function toResponse(row: MotelRow): MotelResponse {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function listMotels(managerId: string): Promise<MotelResponse[]> {
  const rows = await db.query.motels.findMany({
    where: eq(motels.managerId, managerId),
    orderBy: [asc(motels.createdAt), asc(motels.id)],
  });
  return rows.map(toResponse);
}

/**
 * Fields are copied one by one rather than spread, so nothing the client sent beyond the
 * documented body — a `managerId`, for instance — can ever reach the insert.
 */
export async function createMotel(managerId: string, input: CreateMotelInput): Promise<MotelResponse> {
  const [row] = await db
    .insert(motels)
    .values({
      managerId,
      name: input.name,
      address: input.address ?? null,
      electricityPrice: parseAmount(input.electricityPrice),
      waterPrice: parseAmount(input.waterPrice),
      otherFees: input.otherFees === undefined ? [] : toFees(input.otherFees),
      bankAccount: input.bankAccount ?? null,
    })
    .returning();
  return toResponse(row!);
}

export async function getMotel(motelId: string, managerId: string): Promise<MotelResponse> {
  return toResponse(await resolveOwnedMotel(motelId, managerId));
}

/**
 * A true partial update: a key absent from the body is absent from the patch, so an
 * `undefined` can never overwrite a stored value. An explicit `otherFees: []` or
 * `bankAccount: null` is the only way to clear those two.
 */
export async function updateMotel(
  motelId: string,
  managerId: string,
  input: UpdateMotelInput,
): Promise<MotelResponse> {
  const owned = await resolveOwnedMotel(motelId, managerId);

  const patch: MotelPatch = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.address !== undefined) patch.address = input.address;
  if (input.electricityPrice !== undefined) patch.electricityPrice = parseAmount(input.electricityPrice);
  if (input.waterPrice !== undefined) patch.waterPrice = parseAmount(input.waterPrice);
  if (input.otherFees !== undefined) patch.otherFees = toFees(input.otherFees);
  if (input.bankAccount !== undefined) patch.bankAccount = input.bankAccount;

  // `update ... set` with no columns is a syntax error, and `{}` is a legal request.
  if (Object.keys(patch).length === 0) return toResponse(owned);

  const [row] = await db.update(motels).set(patch).where(eq(motels.id, motelId)).returning();
  return toResponse(row!);
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
export async function deleteMotel(motelId: string, managerId: string): Promise<void> {
  await resolveOwnedMotel(motelId, managerId);

  const occupiedRooms = await countOccupiedRoomsForMotel(motelId);
  if (occupiedRooms > 0) {
    throw AppError.conflict(
      `Còn ${occupiedRooms} phòng đang có người thuê. Hãy chuyển phòng về trống trước khi xóa nhà trọ.`,
    );
  }

  const rooms = await countRoomsForMotel(motelId);
  if (rooms > 0) {
    throw AppError.conflict(
      `Còn ${rooms} phòng. Hãy xóa hết phòng trước khi xóa nhà trọ.`,
    );
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

  await db.delete(motels).where(eq(motels.id, motelId));
}