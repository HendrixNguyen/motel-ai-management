import { serverGet } from "./server";
import type { ListRentersFilters, RenterDetailResponse, RenterResponse } from "./types";

/**
 * Renter reads. Server Components only — the mutations are in `renters.client.ts`.
 */

/** `GET /api/manager/motels/:motelId/renters` — `renter.route.ts:87`. */
const RENTERS = (motelId: string): string =>
  `/api/manager/motels/${encodeURIComponent(motelId)}/renters`;

/**
 * The renters of one motel — `renter.service.ts:150` returns a bare array.
 *
 * `roomId` is a filter here as well as an assignment: an unassigned renter has `roomId: null`
 * (`renter.schema.ts:38`), so "everyone in P.101" and "everyone not yet assigned" are both questions
 * this answer, and the second is `roomId: undefined` rather than a sentinel value the backend would
 * have to recognise.
 */
export function listRenters(
  motelId: string,
  filters: ListRentersFilters = {},
): Promise<RenterResponse[]> {
  const query = new URLSearchParams();
  if (filters.status !== undefined) query.set("status", filters.status);
  if (filters.roomId !== undefined) query.set("roomId", filters.roomId);
  if (filters.search !== undefined && filters.search !== "") query.set("search", filters.search);

  const search = query.toString();
  return serverGet<RenterResponse[]>(search === "" ? RENTERS(motelId) : `${RENTERS(motelId)}?${search}`);
}

/**
 * `GET /api/manager/motels/:motelId/renters/:renterId` — `renter.route.ts:115`.
 *
 * This is the only endpoint that answers `RenterDetailResponse`: the row, the live contract and the
 * recent invoices, composed in the service (`renter.service.ts:246`) rather than in the route. A
 * renter with neither answers `activeContract: null` and `invoices: []`, which is a state a motel
 * really has.
 */
export function getRenter(motelId: string, renterId: string): Promise<RenterDetailResponse> {
  return serverGet<RenterDetailResponse>(
    `${RENTERS(motelId)}/${encodeURIComponent(renterId)}`,
  );
}
