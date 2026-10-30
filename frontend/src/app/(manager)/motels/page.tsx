import { listMotels } from "@/lib/api/motels";
import { listRooms } from "@/lib/api/rooms";
import { formatVnd } from "@/lib/format/vnd";
import MotelEditor from "@/components/manager/motel-editor";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import PageHeader from "@/components/ui/page-header";
import { Button } from "@/components/ui/shadcn/button";
import Card from "@/components/ui/card";
import Link from "next/link";
import { motelHref } from "@/lib/motel-navigation";

export default async function Motels({
  searchParams,
}: {
  searchParams: Promise<MotelSearchParams>;
}) {
  const motels = await listMotels();
  const params = await searchParams;
  if (typeof params.motel === "string" && params.motel !== "")
    resolveMotelId(motels, { motel: params.motel });
  // The API has no count endpoint. One unfiltered rooms read per motel is acceptable at MVP
  // scale (10–40 rooms); replace it with backend aggregation if the portfolio grows.
  const cards = await Promise.all(
    motels.map(async (motel) => ({ motel, roomCount: (await listRooms(motel.id)).length })),
  );

  return (
    <section className="min-w-0 space-y-6">
      <PageHeader
        title="Nhà trọ"
        description="Quản lý thông tin, đơn giá và tài khoản nhận tiền của các nhà trọ."
        actions={cards.length > 0 && <MotelEditor />}
      />
      {cards.length === 0 ? (
        <MotelEditor empty />
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ motel, roomCount }) => (
            <Card
              as="article"
              key={motel.id}
              aria-labelledby={`motel-${motel.id}`}
              className="flex min-w-0 flex-col overflow-hidden p-0"
            >
              <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <h2
                    id={`motel-${motel.id}`}
                    className="font-heading text-lg font-semibold text-text [overflow-wrap:anywhere]"
                  >
                    {motel.name}
                  </h2>
                  <p className="mt-1 text-sm text-text-muted [overflow-wrap:anywhere]">
                    {motel.address || "Chưa có địa chỉ"}
                  </p>
                </div>
                <p className="shrink-0 rounded-full bg-primary-fixed px-3 py-1 text-sm font-semibold text-on-primary-fixed tabular-nums">
                  {roomCount} phòng
                </p>
              </div>
              <dl className="grid min-w-0 gap-3 p-4 sm:grid-cols-2 sm:p-5">
                <div className="min-w-0">
                  <dt className="text-sm text-text-muted">Giá điện / kWh</dt>
                  <dd className="mt-1 overflow-x-auto font-semibold text-text tabular-nums whitespace-nowrap">
                    {formatVnd(motel.electricityPrice)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-text-muted">Giá nước / m³</dt>
                  <dd className="mt-1 overflow-x-auto font-semibold text-text tabular-nums whitespace-nowrap">
                    {formatVnd(motel.waterPrice)}
                  </dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-sm text-text-muted">Chủ tài khoản nhận tiền</dt>
                  <dd className="mt-1 text-text [overflow-wrap:anywhere]">
                    {motel.bankAccount?.accountName ?? "Chưa thiết lập"}
                  </dd>
                </div>
              </dl>
              <div className="mt-auto flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-canvas/60 px-4 py-3 sm:px-5">
                <span className="text-sm text-text-muted">Cấu hình vận hành</span>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={motelHref("/rooms", "", motel.id)}>Phòng</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={motelHref("/billing", "", motel.id)}>Hóa đơn</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={motelHref("/renters", "", motel.id)}>Khách thuê</Link>
                  </Button>
                  <MotelEditor motel={motel} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
