import { listMotels } from "@/lib/api/motels";
import { listRooms } from "@/lib/api/rooms";
import { formatVnd } from "@/lib/format/vnd";
import MotelEditor from "@/components/manager/motel-editor";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";

export default async function Motels({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  const motels = await listMotels();
  resolveMotelId(motels, await searchParams);
  // The API has no count endpoint. One unfiltered rooms read per motel is acceptable at MVP
  // scale (10–40 rooms); replace it with backend aggregation if the portfolio grows.
  const cards = await Promise.all(motels.map(async (motel) => ({ motel, roomCount: (await listRooms(motel.id)).length })));

  return <section className="space-y-6">
    <PageHeader title="Nhà trọ" description="Quản lý thông tin, đơn giá và tài khoản nhận tiền của các nhà trọ." actions={cards.length > 0 && <MotelEditor />} />
    {cards.length === 0 ? <EmptyState title="Chưa có nhà trọ" description="Chưa có nhà trọ, bấm Tạo nhà trọ để bắt đầu." actionLabel="Tạo nhà trọ" onAction={() => {}} /> : <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ motel, roomCount }) => <article key={motel.id} aria-labelledby={`motel-${motel.id}`} className="flex min-w-0 flex-col rounded-card border border-border bg-surface p-4 sm:p-6">
        <h2 id={`motel-${motel.id}`} className="font-heading text-lg font-semibold text-text [overflow-wrap:anywhere]">{motel.name}</h2>
        <p className="mt-2 text-base text-text-muted [overflow-wrap:anywhere]">{motel.address || "Chưa có địa chỉ"}</p>
        <p className="mt-4 inline-flex w-fit rounded-full bg-primary-fixed px-3 py-1 text-sm font-semibold text-on-primary-fixed tabular-nums">{roomCount} phòng</p>
        <dl className="mt-4 space-y-3 border-t border-border pt-4 text-base">
          <div><dt className="text-sm text-text-muted">Giá điện / kWh</dt><dd className="mt-1 overflow-x-auto text-text tabular-nums whitespace-nowrap">{formatVnd(motel.electricityPrice)}</dd></div>
          <div><dt className="text-sm text-text-muted">Giá nước / m³</dt><dd className="mt-1 overflow-x-auto text-text tabular-nums whitespace-nowrap">{formatVnd(motel.waterPrice)}</dd></div>
          <div><dt className="text-sm text-text-muted">Chủ tài khoản nhận tiền</dt><dd className="mt-1 text-text [overflow-wrap:anywhere]">{motel.bankAccount?.accountName ?? "Chưa thiết lập"}</dd></div>
        </dl>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"><span className="text-sm text-text-muted">Cấu hình vận hành</span><MotelEditor motel={motel} /></div>
      </article>)}
    </div>}
  </section>;
}
