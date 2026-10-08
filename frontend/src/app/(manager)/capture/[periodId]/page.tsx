import Link from "next/link";
import { notFound } from "next/navigation";
import { getBillingPeriod } from "@/lib/api/billing";
import { listMotels } from "@/lib/api/motels";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import PageHeader from "@/components/ui/page-header";

export default async function CapturePeriodPage({ params, searchParams }: { params: Promise<{ periodId: string }>; searchParams: Promise<MotelSearchParams> }) {
  const [route, query, motels] = await Promise.all([params, searchParams, listMotels()]);
  const motelId = resolveMotelId(motels, query); if (!motelId) notFound();
  const period = await getBillingPeriod(motelId, route.periodId); const locked = period.status !== "draft";
  const total = period.rooms.length; const done = period.rooms.filter((room) => room.readings.every((reading) => reading.currentReading !== null)).length;
  return <section className="space-y-6"><PageHeader title={`Nhập chỉ số ${String(period.month).padStart(2, "0")}/${period.year}`} description={`${done}/${total} phòng đã nhập`} /><div className="rounded-card border border-border bg-surface p-4"><h2 className="font-heading font-semibold">Hàng đợi nhập chỉ số</h2><div className="mt-3 space-y-2">{period.rooms.map((room) => <p key={room.id} className="flex justify-between text-sm"><span>Phòng {room.name}</span><span className="text-text-muted">{room.readings.map((reading) => `${reading.type === "electric" ? "Điện" : "Nước"}: ${reading.currentReading ?? "Chưa nhập"} · trước ${reading.previousReading}`).join(" · ")}</span></p>)}</div></div><div role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} className="h-2 overflow-hidden rounded-full bg-border"><span className="block h-full bg-primary" style={{ width: `${total ? done / total * 100 : 0}%` }} /></div><div className="grid gap-3">{period.rooms.map((room, index) => <Link key={room.id} href={`/capture/${period.id}/room/${room.readings[0]?.id ?? ""}?motel=${encodeURIComponent(motelId)}&room=${encodeURIComponent(room.id)}`} aria-disabled={locked} className={`rounded-card border border-border bg-surface p-4 ${locked ? "pointer-events-none opacity-60" : ""}`}><strong>Phòng {room.name}</strong><span className="ml-2 text-text-muted">{index + 1}/{total}</span><span className="mt-1 block text-sm text-text-muted">{room.readings.filter((reading) => reading.currentReading !== null).length}/{room.readings.length} công tơ đã nhập</span></Link>)}</div>{locked && <p role="status" className="rounded-card border border-warning bg-warning-bg p-4 text-warning">Kỳ đã chốt. Hàng đợi được khóa, không thử gửi lại.</p>}</section>;
}
