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
import { Button } from "@/components/ui/shadcn/button";
import LoginRequestQueue from "@/components/manager/login-request-queue";

export default async function Renters({
  searchParams,
}: {
  searchParams: Promise<MotelSearchParams>;
}) {
  const motels = await listMotels();
  const params = await searchParams;
  if (typeof params.motel === "string" && params.motel !== "")
    resolveMotelId(motels, { motel: params.motel });
  const motelId = resolveMotelId(motels, params);
  if (!motelId) {
    if (!motels.length)
      return (
        <section className="min-w-0 space-y-6">
          <PageHeader
            title="Khách thuê"
            description="Thông tin liên hệ, phòng thuê và hồ sơ của khách thuê."
          />
          <MotelEditor empty />
        </section>
      );
    return (
      <section className="min-w-0 space-y-6">
        <PageHeader
          title="Khách thuê"
          description="Chọn một nhà trọ để xem danh sách khách thuê."
          actions={<MotelEditor />}
        />
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {motels.map((motel) => (
            <Card as="article" key={motel.id} className="flex min-w-0 flex-col p-4 sm:p-6">
              <h2 className="font-heading text-lg font-semibold text-text [overflow-wrap:anywhere]">
                {motel.name}
              </h2>
              <p className="mt-1 text-sm text-text-muted [overflow-wrap:anywhere]">
                {motel.address || "Chưa có địa chỉ"}
              </p>
              <div className="mt-auto pt-4">
                <Button asChild size="sm">
                  <Link href={motelHref("/renters", "", motel.id)}>Xem khách thuê</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    );
  }
  const roomId = typeof params.roomId === "string" && params.roomId ? params.roomId : undefined;
  const [rawRenters, rooms] = await Promise.all([
    listRenters(motelId, roomId ? { roomId } : {}),
    listRooms(motelId),
  ]);
  const renters = [...rawRenters].sort((a, b) =>
    a.status === b.status ? 0 : a.status === "active" ? -1 : 1,
  );
  const roomNames = Object.fromEntries(rooms.map((room) => [room.id, room.name]));
  return (
    <section className="min-w-0 space-y-6">
      <PageHeader
        title="Khách thuê"
        description="Thông tin liên hệ, phòng thuê và hồ sơ của khách thuê."
        actions={
          <RenterEditor
            key={`${motelId}:${params.create === "1"}`}
            motelId={motelId}
            rooms={rooms}
            initiallyOpen={params.create === "1"}
          />
        }
      />
      <LoginRequestQueue motelId={motelId} />
      {roomId && (
        <div className="flex min-w-0 flex-wrap items-center gap-3 text-base text-text-body">
          <p className="[overflow-wrap:anywhere]">Phòng: {roomNames[roomId] ?? "Chưa cập nhật"}</p>
          <Button asChild variant="link" size="sm">
            <Link href={`/renters?${new URLSearchParams({ motel: motelId })}`}>
              Xem tất cả khách thuê
            </Link>
          </Button>
        </div>
      )}
      {renters.length ? (
        <RenterTable
          key={`${motelId}:${roomId ?? ""}`}
          renters={renters}
          rooms={rooms}
          roomNames={roomNames}
          motelId={motelId}
          roomId={roomId}
        />
      ) : (
        <Card className="text-center">
          <h2 className="font-heading text-lg font-semibold text-text">
            {roomId ? "Chưa có khách thuê trong phòng này" : "Chưa có khách thuê"}
          </h2>
          <p className="mt-2 text-base text-text-muted">
            {roomId
              ? "Xem tất cả khách thuê để kiểm tra các phòng khác."
              : "Chọn Thêm khách thuê để tạo hồ sơ và xếp phòng."}
          </p>
        </Card>
      )}
    </section>
  );
}
