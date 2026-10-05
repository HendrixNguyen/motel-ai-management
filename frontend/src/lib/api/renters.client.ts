import { apiSend } from "./client";
import type { CreateRenterInput, RenterResponse, UpdateRenterInput } from "./types";

/**
 * Renter mutations, in the browser. See `motels.client.ts` for why these are split out.
 */

/** `POST /api/manager/motels/:motelId/renters` — `renter.route.ts:95`. */
const RENTERS = (motelId: string): string =>
  `/api/manager/motels/${encodeURIComponent(motelId)}/renters`;

/**
 * Files a renter and answers 201 with the created row (`renter.route.ts:95-113`).
 *
 * There is no `status` in the input, and not by accident: a renter starts `active`
 * (`renter.types.ts:19-24`), and accepting `inactive` at creation would let a tenancy exist that
 * never began. `status` is reachable through a patch, which is the only way to reach it.
 *
 * `409` on a duplicate `(motelId, phone)`, and the message names the **normalised** number
 * (`renter.service.ts:218`) — so a manager who typed `0901234567` and one who typed `84901234567` are
 * shown the same string, and it is the number that is actually stored.
 */
export function createRenter(
  motelId: string,
  input: CreateRenterInput,
): Promise<RenterResponse> {
  return apiSend<RenterResponse>(RENTERS(motelId), "POST", input);
}

/**
 * Patches a renter — `renter.route.ts:123`.
 *
 * `roomId: null` unassigns and `idNumber: null` clears; leaving a key out leaves the stored value
 * alone. The phone is normalised before it is written (`renter.service.ts:273`), so a malformed number
 * is a 400 the manager can read rather than a 500 from the `renters_phone_normalised` CHECK.
 */
export function updateRenter(
  motelId: string,
  renterId: string,
  input: UpdateRenterInput,
): Promise<RenterResponse> {
  return apiSend<RenterResponse>(
    `${RENTERS(motelId)}/${encodeURIComponent(renterId)}`,
    "PATCH",
    input,
  );
}

/**
 * Deletes a renter — `renter.route.ts:135`. Answers 204, so this resolves `undefined`.
 *
 * A soft delete: it sets `status = inactive` and keeps the financial history, so the renter's invoices
 * remain readable after they leave.
 */
export function deleteRenter(motelId: string, renterId: string): Promise<void> {
  return apiSend<void>(`${RENTERS(motelId)}/${encodeURIComponent(renterId)}`, "DELETE");
}
