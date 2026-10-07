import Link from "next/link";
import { notFound } from "next/navigation";
import { listMotels } from "@/lib/api/motels";
import { getBillingPeriod } from "@/lib/api/billing";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import BillingCapture from "@/components/manager/billing-capture";

export default async function BillingPeriodPage({ params, searchParams }: { params: Promise<{ periodId: string }>; searchParams: Promise<MotelSearchParams> }) {
  const [route, query, motels] = await Promise.all([params, searchParams, listMotels()]);
  const motelId = resolveMotelId(motels, query); if (!motelId) return <p>Chưa có nhà trọ.</p>;
  let period; try { period = await getBillingPeriod(motelId, route.periodId); } catch { notFound(); }
  return <section className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-heading text-2xl font-bold text-text">Tháng {String(period.month).padStart(2, "0")}/{period.year}</h1><p className="mt-2 text-text-muted">Nhập chỉ số điện nước cho từng phòng.</p></div><Link href={`/billing/${period.id}/invoices?motel=${encodeURIComponent(motelId)}`} className="inline-flex min-h-11 items-center rounded-input bg-primary px-4 font-semibold text-surface">Xem hóa đơn</Link></div><BillingCapture motelId={motelId} period={period} /></section>;
}
