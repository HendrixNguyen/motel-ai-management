import { type VndString } from "@/shared/money";
import { motels } from "./motel.schema";

export type MotelRow = typeof motels.$inferSelect;

/**
 * A VND amount on the wire. Always a JSON string of digits (`"3850000"`), never a number.
 *
 * Re-exported from `shared/money` rather than redeclared: every module that carries VND over HTTP
 * now names the same alias, and one home for it is one place it cannot drift from.
 *
 * `MotelResponse` declares the money fields as `VndString`, so assigning a row to it fails to
 * compile if `numeric` ever starts handing back a JS number — the guarantee is the type,
 * not a habit at the call site.
 */
export type { VndString };

export interface MotelFeeInput {
  name: string;
  /** VND, whole units. */
  amount: VndString;
}

export interface BankAccountInput {
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export interface CreateMotelInput {
  name: string;
  address?: string | null;
  electricityPrice: VndString;
  waterPrice: VndString;
  otherFees?: MotelFeeInput[];
  bankAccount?: BankAccountInput | null;
}

/** Every key optional; a key absent from the body is never written. */
export interface UpdateMotelInput {
  name?: string;
  address?: string | null;
  electricityPrice?: VndString;
  waterPrice?: VndString;
  otherFees?: MotelFeeInput[];
  bankAccount?: BankAccountInput | null;
}

export interface MotelResponse {
  id: string;
  managerId: string;
  name: string;
  address: string | null;
  electricityPrice: VndString;
  waterPrice: VndString;
  otherFees: MotelFeeInput[];
  bankAccount: BankAccountInput | null;
  /** ISO-8601 UTC string on the wire, as the contract asks. */
  createdAt: string;
}