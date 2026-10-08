import Link from "next/link";
import PageHeader from "@/components/ui/page-header";
import MotelEditor from "@/components/manager/motel-editor";
import { listBillingPeriods, listInvoices } from "@/lib/api/billing";
import { listMotels } from "@/lib/api/motels";
import { listRenters } from "@/lib/api/renters";
import { listRooms } from "@/lib/api/rooms";
import type { RoomStatus } from "@/lib/api/types";
import { motelHref } from "@/lib/motel-navigation";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";

function Metric({ label, value, detail, href }: { label: string; value: string; detail: string; href?: string }) {
  const content = <div className="rounded-card border border-border bg-surface p-4"><p className="text-sm text-text-muted">{label}</p><p className="mt-1 font-heading text-2xl font-bold tabular-nums text-text">{value}</p><p className="mt-1 text-sm text-text-body">{detail}</p></div>;
  return href ? <Link className="block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={href}>{content}</Link> : content;
}

export default async function Overview({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  const motels = await listMotels();
  const motelId = resolveMotelId(motels, await searchParams);
  if (!motelId) return <section className="space-y-6"><PageHeader title="Tổng quan" description="Việc cần làm hôm nay cho nhà trọ." /><MotelEditor empty /></section>;

  const [rooms, renters, periods] = await Promise.all([listRooms(motelId), listRenters(motelId), listBillingPeriods(motelId)]);
  const counts: Record<RoomStatus, number> = { occupied: 0, available: 0, maintenance: 0 };
  for (const room of rooms) counts[room.status] += 1;
  const latest = periods[0];
  const invoices = latest ? await listInvoices(motelId, latest.id) : [];
  const unpaid = invoices.filter((invoice) => invoice.paymentStatus !== "paid");
  const activeRenters = renters.filter((renter) => renter.status === "active");
  const occupancy = rooms.length ? Math.round(counts.occupied / rooms.length * 100) : 0;

  return <section className="min-w-0 space-y-6">
    <PageHeader title="Tổng quan" description="Việc cần làm hôm nay cho nhà trọ." />
    <section aria-labelledby="dashboard-metrics" className="space-y-3">
      <h2 id="dashboard-metrics" className="font-heading text-lg font-semibold text-text">Tình hình phòng</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Phòng đang thuê" value={`${counts.occupied}/${rooms.length}`} detail={`Tỷ lệ lấp đầy ${occupancy}%`} href={motelHref("/rooms", "status=occupied", motelId)} />
        <Metric label="Phòng trống" value={String(counts.available)} detail="Có thể nhận khách mới" href={motelHref("/rooms", "status=available", motelId)} />
        <Metric label="Khách đang ở" value={String(activeRenters.length)} detail="Khách thuê hoạt động" href={motelHref("/renters", "status=active", motelId)} />
      </div>
    </section>
    <section aria-labelledby="dashboard-tasks" className="space-y-3">
      <h2 id="dashboard-tasks" className="font-heading text-lg font-semibold text-text">Việc cần xử lý</h2>
      <div className="divide-y divide-border rounded-card border border-border bg-surface">
        <Link href={motelHref("/capture", "", motelId)} className="flex min-h-14 items-center justify-between gap-4 p-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"><span><strong className="block text-text">Nhập chỉ số điện nước</strong><span className="text-sm text-text-muted">Mở kỳ nháp để ghi chỉ số theo từng phòng</span></span><span aria-hidden="true" className="text-primary">→</span></Link>
        <Link href={latest ? motelHref(`/billing/${latest.id}/invoices`, "", motelId) : motelHref("/billing", "", motelId)} className="flex min-h-14 items-center justify-between gap-4 p-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"><span><strong className="block text-text">Hóa đơn chưa thanh toán</strong><span className="text-sm text-text-muted">{latest ? `${unpaid.length} hóa đơn trong kỳ ${String(latest.month).padStart(2, "0")}/${latest.year}` : "Chưa có kỳ hóa đơn"}</span></span><span aria-hidden="true" className="text-primary">→</span></Link>
      </div>
    </section>
    <section aria-labelledby="dashboard-actions" className="space-y-3"><h2 id="dashboard-actions" className="font-heading text-lg font-semibold text-text">Thao tác nhanh</h2><Link href={motelHref("/renters", "create=1", motelId)} className="inline-flex min-h-11 items-center rounded-input bg-primary px-4 py-2 font-semibold text-surface hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Thêm khách thuê</Link></section>
    {rooms.length === 0 && <div className="rounded-card border border-border bg-surface p-5"><p className="font-semibold text-text">Chưa có phòng trọ</p><p className="mt-1 text-text-muted">Thêm phòng để bắt đầu theo dõi tình hình nhà trọ.</p><Link className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline" href={motelHref("/rooms", "", motelId)}>Thêm phòng</Link></div>}
  </section>;
}
