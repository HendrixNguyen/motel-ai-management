import Link from "next/link";
import MotelEditor from "@/components/manager/motel-editor";
import StatCard from "@/components/ui/stat-card";
import { listMotels } from "@/lib/api/motels";
import { listRooms } from "@/lib/api/rooms";
import type { RoomStatus } from "@/lib/api/types";
import { motelHref } from "@/lib/motel-navigation";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";

export default async function Overview({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  const motelId = resolveMotelId(await listMotels(), await searchParams);
  if (!motelId) return <section className="space-y-6"><h1 className="font-heading text-2xl font-bold text-text">Tổng quan</h1><MotelEditor empty /></section>;

  // Overview always counts the full room list, even when the URL contains list-screen filters.
  const rooms = await listRooms(motelId);
  const counts: Record<RoomStatus, number> = { occupied: 0, available: 0, maintenance: 0 };
  for (const room of rooms) counts[room.status] += 1;
  const occupancy = rooms.length === 0 ? 0 : Math.round(counts.occupied / rooms.length * 100);

  return <section className="min-w-0 space-y-6">
    <div><h1 className="font-heading text-2xl font-bold text-text">Tổng quan</h1>
      <p className="mt-2 max-w-prose text-base text-text-muted">Tình hình sử dụng phòng của nhà trọ đang chọn.</p></div>
    <div className="max-w-xl">
      <StatCard label="Phòng" value={rooms.length} description={<>
        <p>{`${counts.occupied} đang thuê · ${counts.available} trống · ${counts.maintenance} bảo trì`}</p>
        <p className="mt-2 font-semibold tabular-nums">{`Tỷ lệ lấp đầy: ${occupancy}%`}</p>
      </>} />
    </div>
    {rooms.length === 0 && <div className="space-y-2">
      <h2 className="font-heading text-lg font-semibold text-text">Chưa có phòng trọ</h2>
      <p className="max-w-prose text-base text-text-body">Thêm phòng trong mục Phòng trọ để bắt đầu quản lý.</p>
      <Link href={motelHref("/rooms", "", motelId)} className="inline-flex min-h-11 items-center rounded-input px-3 font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Xem phòng trọ</Link>
    </div>}
    <section aria-labelledby="overview-actions" className="space-y-3">
      <h2 id="overview-actions" className="font-heading text-lg font-semibold text-text">Thao tác nhanh</h2>
      <Link href={motelHref("/renters", "", motelId)} className="inline-flex min-h-11 max-w-full items-center justify-center rounded-input bg-primary px-4 py-2 text-base font-semibold text-surface hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Thêm khách thuê</Link>
    </section>
  </section>;
}
