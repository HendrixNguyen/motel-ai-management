import type { ActiveContractSummary } from "@/modules/contract/contract.service";
import type { RecentInvoice } from "@/modules/billing/billing.service";
import { renterStatus } from "./renter.schema";

export type RenterStatus = (typeof renterStatus.enumValues)[number];

export interface CreateRenterInput {
  name: string;
  /** Local or `+84` form; normalised to `84XXXXXXXXX` before it is stored. */
  phone: string;
  idNumber?: string | null;
  idCardFrontUrl?: string | null;
  idCardBackUrl?: string | null;
  /** Must be a room of *this* motel, or the request is 404. */
  roomId?: string | null;
}

/**
 * Every key optional; a key absent from the body is never written.
 *
 * There is no `status` on create: a renter starts `active`, and accepting `inactive` at creation
 * would let a row exist with no tenancy behind it. `status` becomes settable through a patch,
 * which is also the only way to reach it.
 */
export interface UpdateRenterInput {
  name?: string;
  phone?: string;
  idNumber?: string | null;
  idCardFrontUrl?: string | null;
  idCardBackUrl?: string | null;
  /** Must be a room of *this* motel, or the request is 404. An explicit `null` unassigns. */
  roomId?: string | null;
  status?: RenterStatus;
}

export interface ListRentersFilters {
  status?: RenterStatus;
  roomId?: string;
  search?: string;
}

export interface RenterResponse {
  id: string;
  motelId: string;
  name: string;
  /** Always the normalised `84XXXXXXXXX` form, whatever the client sent. */
  phone: string;
  idNumber: string | null;
  idCardFrontUrl: string | null;
  idCardBackUrl: string | null;
  /** Null until the renter is assigned a room. */
  roomId: string | null;
  zaloOaId: string | null;
  isOaFollower: boolean;
  status: RenterStatus;
  /** ISO-8601 UTC string on the wire, as the contract asks. */
  createdAt: string;
}

/**
 * The detail view: the renter, plus the two things a manager opens this screen to see.
 *
 * Both summaries are the owning modules' own types, imported rather than restated, so a change to
 * a contract or an invoice cannot leave a stale copy of it behind here. Their money fields are
 * declared `VndString` where they are defined — `shared/money` — so `monthlyRent` and
 * `totalAmount` are compile-time guarantees of a digit string, not of a `string` that happens to
 * hold digits.
 *
 * `activeContract` is `null` and `invoices` is `[]` for a renter with neither. That is a state a
 * motel actually has — a tenant who moved in before the contract was written — and answering it
 * with an empty object would be a lie.
 */
export interface RenterDetailResponse extends RenterResponse {
  activeContract: ActiveContractSummary | null;
  invoices: RecentInvoice[];
}
