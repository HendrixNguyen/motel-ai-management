"use client";

import { useState, type ReactNode } from "react";
import Button from "./button";
import FilterBar from "./filter-bar";
import { getTablePage, type SortValue } from "./table-model";

export type DataColumn<T> = { key: string; label: string; render: (row: T) => ReactNode; sortValue?: (row: T) => SortValue; money?: boolean };
export type DataTableProps<T> = { rows: readonly T[]; columns: readonly DataColumn<T>[]; getRowId: (row: T) => string; searchText?: (row: T) => string; pageSize?: number; caption: string };

export default function DataTable<T>({ rows, columns, getRowId, searchText, pageSize = 10, caption }: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const result = getTablePage({ rows, searchText, query, page, pageSize, sortValue: columns.find((column) => column.key === sort?.key)?.sortValue, direction: sort?.direction });

  return (
    <div className="min-w-0 space-y-4">
      {searchText && <FilterBar search={query} onSearchChange={(value) => { setQuery(value); setPage(1); }} />}
      <table className="block w-full table-fixed border-collapse text-base sm:table sm:text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="block sm:table-header-group"><tr className="flex flex-wrap gap-2 sm:table-row">
          {columns.map((column) => <th key={column.key} scope="col" aria-sort={column.sortValue ? sort?.key === column.key ? sort.direction === "asc" ? "ascending" : "descending" : "none" : undefined} className={`text-left text-xs font-semibold text-text-muted sm:border-b sm:border-border sm:p-2 ${column.sortValue ? "block sm:table-cell" : "sr-only sm:not-sr-only sm:table-cell"}`}>
            {column.sortValue ? <Button variant="ghost" size="sm" className="w-full justify-start text-left" onClick={() => { setSort({ key: column.key, direction: sort?.key === column.key && sort.direction === "asc" ? "desc" : "asc" }); setPage(1); }}>
              {column.label}<span className="sr-only"> — Sắp xếp</span>{sort?.key === column.key && <span aria-hidden="true">{sort.direction === "asc" ? "↑" : "↓"}</span>}
            </Button> : column.label}
          </th>)}
        </tr></thead>
        <tbody className="block sm:table-row-group">
          {result.rows.map((row) => <tr key={getRowId(row)} className="my-3 block rounded-card border border-border bg-surface p-3 sm:my-0 sm:table-row sm:border-0 sm:p-0">
            {columns.map((column) => <td key={column.key} data-label={column.label} className={`grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2 break-words sm:table-cell sm:border-b sm:border-border sm:p-3 ${column.money ? "tabular-nums" : ""}`}>
              <span aria-hidden="true" className="text-xs font-semibold text-text-muted sm:hidden">{column.label}</span><div className={`min-w-0 ${column.money ? "overflow-x-auto whitespace-nowrap [overflow-wrap:normal]" : "[overflow-wrap:anywhere]"}`}>{column.render(row)}</div>
            </td>)}
          </tr>)}
        </tbody>
      </table>
      {result.total === 0 && <p role="status" className="rounded-card border border-border bg-surface p-4 text-text-muted">Không có kết quả. Thử thay đổi từ khóa hoặc bộ lọc.</p>}
      <nav aria-label={`Phân trang ${caption}`} className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setPage(result.page - 1)} disabled={result.page === 1} aria-label="Trang trước">Trước</Button>
        <span role="status" className="text-sm text-text-muted tabular-nums">Trang {result.page} / {result.pageCount} · {result.total} kết quả</span>
        <Button variant="secondary" onClick={() => setPage(result.page + 1)} disabled={result.page === result.pageCount} aria-label="Trang sau">Sau</Button>
      </nav>
    </div>
  );
}
