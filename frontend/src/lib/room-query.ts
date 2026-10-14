import type { ListRoomsFilters } from "@/lib/api/types";
import type { MotelSearchParams } from "@/lib/motel-selection";
/** The API floor is PostgreSQL int4; zero and basement floors are valid values. */
export function parseRoomFloor(value: string): number | undefined {
  const text = value.trim();
  if (!/^-?\d+$/.test(text)) return undefined;
  const floor = Number(text);
  return Number.isInteger(floor) && floor >= -2147483648 && floor <= 2147483647 ? floor : undefined;
}

/** Invalid or repeated filters are ignored; only understood scalar values reach the API. */
export function parseRoomFilters(params: MotelSearchParams): ListRoomsFilters {
  const filters: ListRoomsFilters = {};
  const floor = typeof params.floor === "string" ? parseRoomFloor(params.floor) : undefined;
  if (floor !== undefined) filters.floor = floor;
  if (params.status === "available" || params.status === "occupied" || params.status === "maintenance") filters.status = params.status;
  if (typeof params.search === "string" && params.search.trim()) filters.search = params.search.trim();
  return filters;
}

export function roomFiltersHref(motelId: string, filters: ListRoomsFilters): string {
  const params = new URLSearchParams({ motel: motelId });
  if (filters.floor !== undefined) params.set("floor", String(filters.floor));
  if (filters.status !== undefined) params.set("status", filters.status);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  return `/rooms?${params}`;
}
