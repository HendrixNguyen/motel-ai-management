import type { BankAccountInput, CreateMotelInput, MotelResponse, UpdateMotelInput } from "@/lib/api/types";
import { ApiError, GENERIC_ERROR_MESSAGE } from "@/lib/api/client";
import { createMotel, updateMotel } from "@/lib/api/motels.client";
import { formatVndPlain, parseVndDigits } from "@/lib/format/vnd";

export type MotelDraft = {
  name: string;
  address: string;
  electricityPrice: string;
  waterPrice: string;
  otherFees: { name: string; amount: string }[];
  bankEnabled: boolean;
  bankAccount: BankAccountInput;
};
export type MotelFieldErrors = Record<string, string>;
type PreparedMotel<T> = { ok: true; input: T } | { ok: false; fields: MotelFieldErrors };
type MotelSubmitResult = { ok: true; motel?: MotelResponse } | { ok: false; fields?: MotelFieldErrors; error?: string; status?: number };

export function createMotelDraft(motel?: MotelResponse): MotelDraft {
  return {
    name: motel?.name ?? "",
    address: motel?.address ?? "",
    electricityPrice: motel ? formatVndPlain(motel.electricityPrice) : "",
    waterPrice: motel ? formatVndPlain(motel.waterPrice) : "",
    otherFees: motel?.otherFees.map((fee) => ({ name: fee.name, amount: formatVndPlain(fee.amount) })) ?? [],
    bankEnabled: Boolean(motel?.bankAccount),
    bankAccount: motel?.bankAccount ? { ...motel.bankAccount } : { bankCode: "", accountNumber: "", accountName: "" },
  };
}

/** One opened form owns its draft and submission baseline together. */
export function createMotelFormSession(motel?: MotelResponse) {
  const original = motel ? structuredClone(motel) : undefined;
  return {
    initialDraft: createMotelDraft(original),
    submit: (draft: MotelDraft) => submitMotel(draft, original),
  };
}

/** Local validation owns field errors; the API carries no field-level details (D8). */
export function prepareMotelInput(draft: MotelDraft): PreparedMotel<CreateMotelInput>;
export function prepareMotelInput(draft: MotelDraft, original: MotelResponse): PreparedMotel<UpdateMotelInput>;
export function prepareMotelInput(draft: MotelDraft, original?: MotelResponse): PreparedMotel<CreateMotelInput | UpdateMotelInput> {
  const fields: MotelFieldErrors = {};
  function amount(value: string, field: string): string {
    const digits = parseVndDigits(value);
    if (digits === null) fields[field] = "Nhập số tiền VND hợp lệ, ví dụ 3.500";
    // Normalized digits let us check numeric(14,0) without converting money to a float.
    else if (digits.length > 14) fields[field] = "Số tiền tối đa là 99.999.999.999.999 ₫";
    return digits ?? "";
  }
  const input: CreateMotelInput = {
    name: draft.name.trim(),
    address: draft.address.trim() || null,
    electricityPrice: amount(draft.electricityPrice, "electricityPrice"),
    waterPrice: amount(draft.waterPrice, "waterPrice"),
  };
  if (!input.name) fields.name = "Nhập tên nhà trọ";

  if (original) {
    input.otherFees = draft.otherFees.map((fee, index) => {
      const name = fee.name.trim();
      if (!name) fields[`otherFees.${index}.name`] = "Nhập tên phí";
      return { name, amount: amount(fee.amount, `otherFees.${index}.amount`) };
    });
    input.bankAccount = null;
    if (draft.bankEnabled) {
      input.bankAccount = {
        bankCode: draft.bankAccount.bankCode.trim(),
        accountNumber: draft.bankAccount.accountNumber.trim(),
        accountName: draft.bankAccount.accountName.trim(),
      };
      const labels = { bankCode: "Nhập mã ngân hàng", accountNumber: "Nhập số tài khoản", accountName: "Nhập tên chủ tài khoản" };
      for (const key of ["bankCode", "accountNumber", "accountName"] as const) {
        if (!input.bankAccount[key]) fields[`bankAccount.${key}`] = labels[key];
      }
    }
  }
  if (Object.keys(fields).length) return { ok: false, fields };
  if (!original) return { ok: true, input };

  const patch: UpdateMotelInput = {};
  if (input.name !== original.name) patch.name = input.name;
  if (input.address !== original.address) patch.address = input.address;
  if (input.electricityPrice !== original.electricityPrice) patch.electricityPrice = input.electricityPrice;
  if (input.waterPrice !== original.waterPrice) patch.waterPrice = input.waterPrice;
  const fees = input.otherFees ?? [];
  if (fees.length !== original.otherFees.length || fees.some((fee, index) => fee.name !== original.otherFees[index]?.name || fee.amount !== original.otherFees[index]?.amount)) patch.otherFees = fees;
  const bank = input.bankAccount ?? null;
  if (bank?.bankCode !== original.bankAccount?.bankCode || bank?.accountNumber !== original.bankAccount?.accountNumber || bank?.accountName !== original.bankAccount?.accountName) patch.bankAccount = bank;
  return { ok: true, input: patch };
}

export async function submitMotel(draft: MotelDraft, original?: MotelResponse): Promise<MotelSubmitResult> {
  try {
    if (original) {
      const prepared = prepareMotelInput(draft, original);
      if (!prepared.ok) return prepared;
      return { ok: true, motel: await updateMotel(original.id, prepared.input) };
    } else {
      const prepared = prepareMotelInput(draft);
      if (!prepared.ok) return prepared;
      return { ok: true, motel: await createMotel(prepared.input) };
    }
    return { ok: true };
  } catch (error) {
    return error instanceof ApiError
      ? { ok: false, error: error.message, status: error.status }
      : { ok: false, error: GENERIC_ERROR_MESSAGE };
  }
}
