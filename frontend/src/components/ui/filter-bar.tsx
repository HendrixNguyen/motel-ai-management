"use client";

import { useId, type ReactNode } from "react";
import Field from "./field";

export default function FilterBar({ search, onSearchChange, searchLabel = "Tìm kiếm", children }: { search: string; onSearchChange: (value: string) => void; searchLabel?: string; children?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-0 flex-1"><Field id={id} label={searchLabel}>{(props) => <input {...props} type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} />}</Field></div>
      {children}
    </div>
  );
}
