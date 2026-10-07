"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { generateInvoices, saveMeterReadings } from "@/lib/api/billing.client";
import type { BillingPeriodDetailResponse, MeterType } from "@/lib/api/types";

export default function BillingCapture({ motelId, period }: { motelId: string; period: BillingPeriodDetailResponse }) {
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(period.rooms.flatMap((room) => room.readings.map((reading) => [`${room.id}:${reading.type}`, reading.currentReading ?? ""]))));
  const [error, setError] = useState<string>(); const [pending, setPending] = useState(false); const router = useRouter();
  const readonly = period.status !== "draft";
  function update(roomId: string, type: MeterType, value: string) { setDraft((current) => ({ ...current, [`${roomId}:${type}`]: value })); }
  async function saveInternal() { if (readonly) return; setError(undefined); const readings = period.rooms.flatMap((room) => room.readings).filter((reading) => draft[`${reading.roomId}:${reading.type}`] !== (reading.currentReading ?? "")).map((reading) => ({ roomId: reading.roomId, type: reading.type, currentReading: draft[`${reading.roomId}:${reading.type}`] ?? "", expectedUpdatedAt: reading.updatedAt })); if (readings.length) await saveMeterReadings(motelId, period.id, { readings }); router.refresh(); }
  async function save() { if (pending || readonly) return; setPending(true); try { await saveInternal(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu chỉ số"); } finally { setPending(false); } }
  async function generate() { if (pending || readonly) return; setPending(true); setError(undefined); try { await saveInternal(); await generateInvoices(motelId, period.id); router.push(`/billing/${period.id}/invoices?motel=${encodeURIComponent(motelId)}`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo hóa đơn"); } finally { setPending(false); } }
  return <div className="space-y-4">{readonly && <div role="status" className="rounded-input border border-warning bg-warning-bg p-3 text-warning">Kỳ đã chốt. Chỉ số ở chế độ chỉ đọc.</div>}{error && <div role="alert" className="rounded-input border border-danger bg-danger-bg p-3 text-danger">{error}</div>}<div className="grid gap-4">{period.rooms.map((room) => <article key={room.id} className="rounded-card border border-border bg-surface p-4"><h2 className="font-heading font-semibold text-text">{room.name}</h2><div className="mt-3 grid grid-cols-2 gap-3">{room.readings.map((reading) => <label key={reading.id} className="space-y-1 text-sm text-text">{reading.type === "electric" ? "Điện (kWh)" : "Nước (m³)"}<span className="block text-xs text-text-muted">Cũ: {reading.previousReading}</span><input disabled={readonly || pending} inputMode="decimal" value={draft[`${reading.roomId}:${reading.type}`]} onChange={(event) => update(reading.roomId, reading.type, event.target.value)} className="min-h-11 w-full rounded-input border border-border bg-surface px-3" /></label>)}</div></article>)}</div>{!readonly && <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={pending}>Lưu nháp</Button><Button variant="secondary" onClick={generate} disabled={pending}>Tạo hóa đơn</Button></div>}</div>;
}
