"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Field from "@/components/ui/field";
import FilterBar from "@/components/ui/filter-bar";
import type { ListRoomsFilters } from "@/lib/api/types";
import { roomStatusLabel } from "@/lib/format/status";
import { parseRoomFilters, parseRoomFloor, roomFiltersHref } from "@/lib/room-query";

export default function RoomFilters({ motelId, filters }: { motelId: string; filters: ListRoomsFilters }) {
  const [search, setSearch] = useState(filters.search ?? "");
  const [floor, setFloor] = useState(filters.floor === undefined ? "" : String(filters.floor));
  const [status, setStatus] = useState(filters.status ?? "");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const floorControl = useRef<HTMLInputElement>(null);
  const prefix = useId();
  const router = useRouter();

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (floor.trim() && parseRoomFloor(floor) === undefined) {
      setError("Nhập tầng bằng số nguyên từ -2.147.483.648 đến 2.147.483.647");
      floorControl.current?.focus();
      return;
    }
    setError(undefined);
    startTransition(() => router.push(roomFiltersHref(motelId, parseRoomFilters({ floor, status, search })), { scroll: false }));
  }

  return <form onSubmit={apply} noValidate aria-label="Bộ lọc phòng trọ" className="min-w-0 space-y-3 rounded-card border border-border bg-surface p-4">
    <fieldset disabled={pending} className="min-w-0 space-y-4">
      <legend className="sr-only">Bộ lọc phòng trọ</legend>
      <FilterBar search={search} onSearchChange={setSearch} searchLabel="Tìm theo tên phòng">
        <div className="min-w-0 sm:w-36"><Field id={`${prefix}-floor`} label="Tầng" hint="Để trống: tất cả tầng" error={error}>{(props) => <input {...props} ref={floorControl}
          type="text" inputMode="numeric" value={floor} onChange={(event) => { setFloor(event.target.value); setError(undefined); }} />}</Field></div>
        <div className="min-w-0 sm:w-44"><Field id={`${prefix}-status`} label="Trạng thái">{(props) => <select {...props} value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="">Tất cả trạng thái</option>
          {(["available", "occupied", "maintenance"] as const).map((value) => <option key={value} value={value}>{roomStatusLabel(value)}</option>)}
        </select>}</Field></div>
      </FilterBar>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" pending={pending} pendingLabel="Đang lọc…">Áp dụng bộ lọc</Button>
        {Object.keys(filters).length > 0 && <Link href={roomFiltersHref(motelId, {})} className="inline-flex min-h-11 items-center rounded-input px-3 text-base font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Xóa bộ lọc</Link>}
      </div>
    </fieldset>
  </form>;
}
