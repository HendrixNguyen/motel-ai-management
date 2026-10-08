import Link from "next/link";
import { listMotels } from "@/lib/api/motels";
import { listBillingPeriods } from "@/lib/api/billing";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import BillingPeriodEditor from "@/components/manager/billing-period-editor";
import PageHeader from "@/components/ui/page-header";
import Badge from "@/components/ui/badge";

const labels = { draft: "Bản nháp", sent: "Đã chốt", closed: "Đã đóng" } as const;

export default async function BillingPage({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  const motels = await listMotels();
  const params = await searchParams;
  const motelId = resolveMotelId(motels, params);
  if (!motelId) return <section className="space-y-4"><PageHeader title="Tính tiền & Hóa đơn" description="Tạo kỳ, nhập số điện nước và chốt hóa đơn." /><p className="rounded-card border border-border bg-surface p-6 text-text-muted">Chưa có nhà trọ để tạo kỳ hóa đơn.</p></section>;
  const periods = await listBillingPeriods(motelId);
  return <section className="space-y-6">
    <PageHeader title="Tính tiền & Hóa đơn" description="Tạo kỳ, nhập số điện nước và chốt hóa đơn." actions={<BillingPeriodEditor motelId={motelId} />} />
    {periods.length === 0 ? <div className="rounded-card border border-border bg-surface p-6 text-text-muted">Chưa có kỳ hóa đơn.</div> : <div className="grid gap-3">{periods.map((period) => <Link key={period.id} href={`/billing/${period.id}?motel=${encodeURIComponent(motelId)}`} className="flex min-h-16 items-center justify-between gap-4 rounded-card border border-border bg-surface p-4 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"><span className="font-semibold text-text">Tháng {String(period.month).padStart(2, "0")}/{period.year}</span><Badge tone={period.status === "sent" ? "success" : period.status === "closed" ? "warning" : "neutral"} label={labels[period.status]} /></Link>)}</div>}
  </section>;
}
