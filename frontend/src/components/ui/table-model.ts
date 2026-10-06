export type SortValue = string | number | bigint;

/** Sort before slicing; money callers supply BigInt so VND never passes through Number. */
export function getTablePage<T>({ rows, searchText, query = "", sortValue, direction = "asc", page = 1, pageSize = 10 }: {
  rows: readonly T[]; searchText?: (row: T) => string; query?: string;
  sortValue?: (row: T) => SortValue; direction?: "asc" | "desc"; page?: number; pageSize?: number;
}) {
  const term = query.trim().toLocaleLowerCase("vi-VN");
  const filtered = rows.filter((row) => !term || !searchText || searchText(row).toLocaleLowerCase("vi-VN").includes(term));
  if (sortValue) filtered.sort((a, b) => {
    const left = sortValue(a), right = sortValue(b);
    const comparison = typeof left === "string" && typeof right === "string" ? left.localeCompare(right, "vi-VN", { numeric: true }) : left < right ? -1 : left > right ? 1 : 0;
    return direction === "asc" ? comparison : -comparison;
  });
  const size = Math.max(1, Math.floor(pageSize) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(pageCount, Math.max(1, Math.floor(page) || 1));
  return { rows: filtered.slice((current - 1) * size, current * size), total: filtered.length, page: current, pageCount };
}
