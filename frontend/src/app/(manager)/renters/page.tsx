import { listMotels } from "@/lib/api/motels";
import { listRenters } from "@/lib/api/renters";
import { listRooms } from "@/lib/api/rooms";
import Link from "next/link";
import MotelEditor from "@/components/manager/motel-editor";
import RenterTable from "@/components/manager/renter-table";
import RenterEditor from "@/components/manager/renter-editor";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import { motelHref } from "@/lib/motel-navigation";
import PageHeader from "@/components/ui/page-header";
import Card from "@/components/ui/card";

export default async function Renters({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  const motels = await listMotels();
  const params = await searchParams;
  const motelId = resolveMotelId(motels, params);
  if (!motelId) {
    if (motels.length === 0) return <section className="space-y-6"><PageHeader title="Khách thuê" description="Thông tin liên hệ, phòng thuê và hồ sơ của khách thuê." /><MotelEditor empty /></section>;
    return <section className="space-y-6">
      <PageHeader title="Khách thuê" description="Chọn một nhà trọ để xem danh sách khách thuê." actions={<MotelEditor />} />
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {motels.map((motel) => <Card as="article" key={motel.id} className="flex flex-col p-4 sm:p-6">
          <h2 className="font-heading text-lg font-semibold text-text [overflow-wrap:anywhere]">{motel.name}</h2>
          <p className="mt-1 text-sm text-text-muted [overflow-wrap:anywhere]">{motel.address || "Chưa có địa chỉ"}</p>
          <div className="mt-auto pt-4">
            <Link href={motelHref("/renters", "", motel.id)} className="inline-flex min-h-11 items-center justify-center rounded-input bg-primary px-4 font-semibold text-surface hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-primary">
              Xem khách thuê
            </Link>
          </div>
        </Card>)}
      </div>
    </section>;
  }
  const roomId = typeof params.roomId === "string" && params.roomId ? params.roomId : undefined;
  const [rawRenters, rooms] = await Promise.all([listRenters(motelId, roomId ? { roomId } : {}), listRooms(motelId)]);
  const renters = [...rawRenters].sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1));
  const roomNames = Object.fromEntries(rooms.map((room) => [room.id, room.name]));
  return <section className="min-w-0 space-y-6">
    <PageHeader title="Khách thuê" description="Thông tin liên hệ, phòng thuê và hồ sơ của khách thuê." />
    <RenterEditor key={motelId} motelId={motelId} rooms={rooms} initiallyOpen={params.create === "1"} />
    {roomId && <div className="flex min-w-0 flex-wrap items-center gap-3 text-base text-text-body">
      <p className="[overflow-wrap:anywhere]">Phòng: {roomNames[roomId] ?? "Chưa cập nhật"}</p>
      <Link href={`/renters?${new URLSearchParams({ motel: motelId })}`} className="inline-flex min-h-11 items-center rounded-input px-2 font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Xem tất cả khách thuê</Link>
    </div>}
{renters.length ? <RenterTable key={`${motelId}:${roomId ?? ""}`} renters={renters} rooms={rooms} roomNames={roomNames} motelId={motelId} roomId={roomId} />
       : <Card className="text-center">
        <h2 className="font-heading text-lg font-semibold text-text">{roomId ? "Chưa có khách thuê trong phòng này" : "Chưa có khách thuê"}</h2>
        <p className="mt-2 text-base text-text-muted">{roomId ? "Xem tất cả khách thuê để kiểm tra các phòng khác." : "Chọn Thêm khách thuê để tạo hồ sơ và xếp phòng."}</p>
       </Card>}
   </section>;
}
