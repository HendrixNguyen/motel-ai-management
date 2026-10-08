import { listMotels } from "@/lib/api/motels";
import { listRooms } from "@/lib/api/rooms";
import { listRenters } from "@/lib/api/renters";
import type { RenterResponse, RoomStatus } from "@/lib/api/types";
import Link from "next/link";
import Badge, { type BadgeTone } from "@/components/ui/badge";
import MotelEditor from "@/components/manager/motel-editor";
import RoomEditor from "@/components/manager/room-editor";
import RoomFilters from "@/components/manager/room-filters";
import { formatVnd } from "@/lib/format/vnd";
import { formatPhone } from "@/lib/format/phone";
import { roomStatusLabel } from "@/lib/format/status";
import { parseRoomFilters, roomFiltersHref } from "@/lib/room-query";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import PageHeader from "@/components/ui/page-header";

const statusTone: Record<RoomStatus, BadgeTone> = { available: "neutral", occupied: "success", maintenance: "warning" };

export default async function Rooms({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  const motels = await listMotels();
  const params = await searchParams;
  const motelId = resolveMotelId(motels, params);
  if (!motelId) return <section className="space-y-6"><PageHeader title="Phòng trọ" description="Quản lý phòng, giá thuê cơ bản và trạng thái sử dụng." /><MotelEditor empty /></section>;
  const filters = parseRoomFilters(params);
  // D10: one read each, then an O(rooms + renters) join; no per-card requests.
  const [rooms, renters] = await Promise.all([listRooms(motelId, filters), listRenters(motelId)]);
  const rentersByRoom = new Map<string, RenterResponse[]>();
  for (const renter of renters) {
    if (renter.status !== "active" || !renter.roomId || renter.motelId !== motelId) continue;
    const matches = rentersByRoom.get(renter.roomId) ?? [];
    matches.push(renter);
    rentersByRoom.set(renter.roomId, matches);
  }
  const filtered = Object.keys(filters).length > 0;
  const filterKey = roomFiltersHref(motelId, filters);

  return <section className="min-w-0 space-y-6">
    <PageHeader title="Phòng trọ" description="Quản lý phòng, giá thuê cơ bản và trạng thái sử dụng." actions={(rooms.length > 0 || filtered) && <RoomEditor key={motelId} motelId={motelId} />} />
    <RoomFilters key={filterKey} motelId={motelId} filters={filters} />
    {rooms.length === 0 ? filtered
      ? <div className="rounded-card border border-border bg-surface p-6 text-center">
        <h2 className="font-heading text-lg font-semibold text-text">Không có phòng phù hợp</h2>
        <p className="mt-2 text-base text-text-body">Thay đổi hoặc xóa bộ lọc để xem các phòng khác.</p>
        <Link href={roomFiltersHref(motelId, {})} className="mt-4 inline-flex min-h-11 items-center rounded-input px-3 font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Xóa bộ lọc</Link>
      </div>
      : <RoomEditor key={motelId} motelId={motelId} empty />
      : <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room) => <article key={room.id} aria-labelledby={`room-${room.id}`} className="flex min-w-0 flex-col rounded-card border border-border bg-surface p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id={`room-${room.id}`} className="min-w-0 font-heading text-lg font-semibold text-text [overflow-wrap:anywhere]">{room.name}</h2>
            <Badge tone={statusTone[room.status]} label={roomStatusLabel(room.status)} />
          </div>
          <p className="mt-2 text-base text-text-muted">{room.floor === null ? "Chưa ghi tầng" : `Tầng ${room.floor}`}</p>
          <dl className="mt-4 space-y-3 border-t border-border pt-4 text-base">
            <div><dt className="text-sm text-text-muted">Giá thuê cơ bản / tháng</dt><dd className="mt-1 overflow-x-auto font-semibold text-text tabular-nums whitespace-nowrap">{formatVnd(room.basePrice)}</dd></div>
            <div><dt className="text-sm text-text-muted">Khách đang thuê</dt><dd className="mt-1 space-y-2 text-text">
              {(rentersByRoom.get(room.id) ?? []).length ? rentersByRoom.get(room.id)!.map((renter) => <div key={renter.id} className="[overflow-wrap:anywhere]">
                <p>{renter.name}</p><a href={`tel:+${renter.phone}`} className="inline-flex min-h-11 items-center rounded-input text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{formatPhone(renter.phone)}</a>
              </div>) : <p className="text-text-muted">Chưa có khách thuê</p>}
            </dd></div>
          </dl>
          <div className="mt-auto space-y-2 pt-5">
            <RoomEditor motelId={motelId} room={room} />
            <Link href={`/renters?${new URLSearchParams({ motel: motelId, roomId: room.id })}`} className="inline-flex min-h-11 items-center rounded-input px-3 font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Xem khách thuê</Link>
          </div>
        </article>)}
      </div>}
  </section>;
}
