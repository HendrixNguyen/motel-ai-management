import Link from "next/link";
import { listMotels } from "@/lib/api/motels";
import { listBillingPeriods } from "@/lib/api/billing";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import PageHeader from "@/components/ui/page-header";

export default async function CapturePage({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  const [motels, query] = await Promise.all([listMotels(), searchParams]);
  const motelId = resolveMotelId(motels, query);
  if (!motelId) return <section className="space-y-4"><PageHeader title="Nhập chỉ số" description="Chụp và nhập số điện nước trên điện thoại." /><p className="rounded-card border border-border bg-surface p-6 text-text-muted">Chưa có nhà trọ.</p></section>;
  const periods = await listBillingPeriods(motelId);
  const draft = periods.find((period) => period.status === "draft");
  return <section className="space-y-6"><PageHeader title="Nhập chỉ số" description="Lưu ngoại tuyến, đồng bộ khi có mạng." />{draft ? <Link href={`/billing/${draft.id}?motel=${encodeURIComponent(motelId)}`} className="flex min-h-14 items-center justify-center rounded-input bg-primary px-4 font-semibold text-surface">Mở kỳ {String(draft.month).padStart(2, "0")}/{draft.year}</Link> : <p className="rounded-card border border-border bg-surface p-6 text-text-muted">Không có kỳ nháp.</p>}</section>;
}
