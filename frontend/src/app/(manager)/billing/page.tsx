import Link from "next/link";
import { listMotels } from "@/lib/api/motels";
import { listBillingPeriods } from "@/lib/api/billing";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import BillingPeriodEditor from "@/components/manager/billing-period-editor";
import PageHeader from "@/components/ui/page-header";
import Badge from "@/components/ui/badge";
import Card from "@/components/ui/card";

const labels = { draft: "Bản nháp", sent: "Đã gửi", closed: "Đã đóng" } as const;

export default async function BillingPage({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  const motels = await listMotels();
  const params = await searchParams;
  const motelId = resolveMotelId(motels, params);
  if (!motelId) return <section className="space-y-4"><PageHeader title="Tính tiền & Hóa đơn" description="Tạo kỳ, nhập số điện nước và chốt hóa đơn." /><p className="rounded-card border border-border bg-surface p-6 text-text-muted">Chưa có nhà trọ để tạo kỳ hóa đơn.</p></section>;
  const periods = await listBillingPeriods(motelId);
return <section className="space-y-6">
     <PageHeader title="Tính tiền & Hóa đơn" description="Theo dõi kỳ tính tiền, nhập chỉ số và chốt hóa đơn." actions={<BillingPeriodEditor motelId={motelId} />} />
     {periods.length === 0 ? <Card className="border-dashed p-8 text-center text-text-muted"><p>Chưa có kỳ hóa đơn.</p><p className="mt-1 text-sm">Tạo kỳ đầu tiên để bắt đầu nhập chỉ số.</p></Card> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{periods.map((period) => <Link key={period.id} href={`/billing/${period.id}?motel=${encodeURIComponent(motelId)}`} className="group rounded-card border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Kỳ tính tiền</p><h2 className="mt-1 font-heading text-xl font-bold text-text">Tháng {String(period.month).padStart(2, "0")}/{period.year}</h2></div><Badge tone={period.status === "sent" ? "success" : period.status === "closed" ? "warning" : "neutral"} label={labels[period.status]} /></div><p className="mt-6 text-sm font-semibold text-primary group-hover:underline">Mở kỳ tính tiền →</p></Link>)}</div>}
   </section>;
}
