import { describe, expect, it } from "vitest";
import { getTablePage } from "../table-model";

const rows = [{ id: "a", name: "Ánh", amount: "10000000000000" }, { id: "b", name: "Bình", amount: "900000000000" }, { id: "c", name: "Chi", amount: "2500000" }];
const options = { rows, searchText: (row: typeof rows[number]) => row.name, pageSize: 2, page: 1, query: "" };

describe("searchable, sortable, paginated rows", () => {
  it("searches Vietnamese names case-insensitively and trims the query", () => {
    const result = getTablePage({ ...options, query: "  ÁNH " });
    expect(result.rows.map((row) => row.id)).toEqual(["a"]);
    expect(result.total).toBe(1);
  });
  it("sorts monetary values as BigInt before pagination without mutating the input", () => {
    const result = getTablePage({ ...options, sortValue: (row) => BigInt(row.amount), direction: "asc" });
    expect(result.rows.map((row) => row.id)).toEqual(["c", "b"]);
    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
  it("reverses ordering for a descending sort", () => {
    expect(getTablePage({ ...options, sortValue: (row) => BigInt(row.amount), direction: "desc" }).rows.map((row) => row.id)).toEqual(["a", "b"]);
  });
  it("clamps stale page selection after filtering and returns a single empty page", () => {
    expect(getTablePage({ ...options, page: 9 }).rows.map((row) => row.id)).toEqual(["c"]);
    expect(getTablePage({ ...options, page: 9 }).page).toBe(2);
    expect(getTablePage({ ...options, query: "Không tồn tại", page: 9 })).toMatchObject({ rows: [], page: 1, pageCount: 1, total: 0 });
  });
});
