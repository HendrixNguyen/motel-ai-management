import Link from "next/link";
import { notFound } from "next/navigation";
import { getBillingPeriod } from "@/lib/api/billing";
import { listMotels } from "@/lib/api/motels";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import PageHeader from "@/components/ui/page-header";

export default async function CapturePeriodPage({ params, searchParams }: { params: Promise<{ periodId: string }>; searchParams: Promise<MotelSearchParams> }) {
  const [route, query, motels] = await Promise.all([params, searchParams, listMotels()]);
  const motelId = resolveMotelId(motels, query); if (!motelId) notFound();
  const period = await getBillingPeriod(motelId, route.periodId);
  const locked = period.status !== "draft";
  return <section className="space-y-6"><PageHeader title={`Nhập chỉ số ${String(period.month).padStart(2, "0")}/${period.year}`} description={locked ? "Kỳ đã chốt, chỉ xem." : "Chọn từng công tơ để nhập hoặc chụp ảnh."} /><div className="grid gap-3">{period.rooms.flatMap((room) => room.readings.map((reading) => <Link key={reading.id} aria-disabled={locked} href={`/capture/${period.id}/room/${reading.id}?motel=${encodeURIComponent(motelId)}`} className={`rounded-card border border-border bg-surface p-4 ${locked ? "pointer-events-none opacity-60" : ""}`}><strong>Phòng {room.name}</strong><span className="ml-2 text-text-muted">{reading.type === "electric" ? "Điện" : "Nước"}</span><span className="mt-1 block text-sm text-text-muted">Cũ: {reading.previousReading} · Mới: {reading.currentReading ?? "chưa nhập"}</span></Link>))}</div>{locked && <p role="status" className="rounded-card border border-warning bg-warning-bg p-4 text-warning">Kỳ đã chốt. Không thể sửa hoặc đồng bộ dữ liệu.</p>}</section>;
}
