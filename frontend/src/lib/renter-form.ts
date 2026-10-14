import type { CreateRenterInput, RenterResponse, UpdateRenterInput } from "@/lib/api/types";
import { ApiError, GENERIC_ERROR_MESSAGE } from "@/lib/api/client";
import { createRenter, updateRenter } from "@/lib/api/renters.client";

export type RenterDraft = { name: string; phone: string; idNumber: string; roomId: string };
export type RenterFieldErrors = Record<string, string>;
export type RenterSubmitResult = { ok: true } | { ok: false; fields?: RenterFieldErrors; error?: string; status?: number };
type Prepared<T> = { ok: true; input: T } | { ok: false; fields: RenterFieldErrors };

export function createRenterDraft(renter?: RenterResponse): RenterDraft {
  return { name: renter?.name ?? "", phone: renter?.phone ?? "", idNumber: renter?.idNumber ?? "", roomId: renter?.roomId ?? "" };
}

export function prepareRenterInput(draft: RenterDraft): Prepared<CreateRenterInput>;
export function prepareRenterInput(draft: RenterDraft, renter: RenterResponse): Prepared<UpdateRenterInput>;
export function prepareRenterInput(draft: RenterDraft, renter?: RenterResponse): Prepared<CreateRenterInput | UpdateRenterInput> {
  const fields: RenterFieldErrors = {};
  const name = draft.name.trim();
  if (!name) fields.name = "Nhập họ tên";
  // Same accepted Vietnamese prefixes and separators as backend/shared/phone.ts.
  const phoneMatch = /^(?:0|\+84|84)([235789]\d{8})$/.exec(draft.phone.replace(/[\s.-]/g, ""));
  if (!phoneMatch) fields.phone = "Nhập số điện thoại Việt Nam hợp lệ";
  if (Object.keys(fields).length) return { ok: false, fields };
  const input: CreateRenterInput = { name, phone: `84${phoneMatch![1]}`, idNumber: draft.idNumber.trim() || null, roomId: draft.roomId || null };
  if (!renter) return { ok: true, input };
  const patch: UpdateRenterInput = {};
  if (name !== renter.name) patch.name = name;
  if (input.phone !== renter.phone) patch.phone = input.phone;
  if (input.idNumber !== renter.idNumber) patch.idNumber = input.idNumber;
  if (input.roomId !== renter.roomId) patch.roomId = input.roomId;
  return { ok: true, input: patch };
}

export async function submitRenter(motelId: string, draft: RenterDraft, renter?: RenterResponse): Promise<RenterSubmitResult> {
  try {
    if (renter) {
      const prepared = prepareRenterInput(draft, renter);
      if (!prepared.ok) return prepared;
      await updateRenter(motelId, renter.id, prepared.input);
    } else {
      const prepared = prepareRenterInput(draft);
      if (!prepared.ok) return prepared;
      await createRenter(motelId, prepared.input);
    }
    return { ok: true };
  } catch (error) {
    return error instanceof ApiError ? { ok: false, error: error.message, status: error.status } : { ok: false, error: GENERIC_ERROR_MESSAGE };
  }
}

/** The draft and partial PATCH baseline belong to this opening, even across RSC refreshes. */
export function createRenterFormSession(motelId: string, renter?: RenterResponse) {
  const original = renter ? structuredClone(renter) : undefined;
  return { initialDraft: createRenterDraft(original), submit: (draft: RenterDraft) => submitRenter(motelId, draft, original) };
}
