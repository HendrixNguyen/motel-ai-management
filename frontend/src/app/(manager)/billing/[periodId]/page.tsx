import Link from "next/link";
import { notFound } from "next/navigation";
import { listMotels } from "@/lib/api/motels";
import { getBillingPeriod } from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";
import PageHeader from "@/components/ui/page-header";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import BillingCapture from "@/components/manager/billing-capture";
import Badge from "@/components/ui/badge";

export default async function BillingPeriodPage({ params, searchParams }: { params: Promise<{ periodId: string }>; searchParams: Promise<MotelSearchParams> }) {
  const [route, query, motels] = await Promise.all([params, searchParams, listMotels()]);
  const motelId = resolveMotelId(motels, query); if (!motelId) return <p>Chưa có nhà trọ.</p>;
  let period; try { period = await getBillingPeriod(motelId, route.periodId); } catch (cause) { if (cause instanceof ApiError && cause.status === 404) notFound(); throw cause; }
  return <section className="space-y-6"><PageHeader title={`Tháng ${String(period.month).padStart(2, "0")}/${period.year}`} description="Nhập chỉ số điện nước cho từng phòng." actions={<><Badge tone={period.status === "sent" ? "success" : period.status === "closed" ? "warning" : "neutral"} label={period.status === "draft" ? "Bản nháp" : period.status === "sent" ? "Đã gửi" : "Đã đóng"} /><Link href={`/billing/${period.id}/invoices?motel=${encodeURIComponent(motelId)}`} className="inline-flex min-h-11 items-center rounded-input bg-primary px-4 font-semibold text-surface">Xem hóa đơn</Link></>} /><BillingCapture motelId={motelId} period={period} /></section>;
}
