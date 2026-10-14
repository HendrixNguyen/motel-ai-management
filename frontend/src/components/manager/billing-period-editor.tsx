"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { createBillingPeriod } from "@/lib/api/billing.client";

export default function BillingPeriodEditor({ motelId }: { motelId: string }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (pending) return; setPending(true); setError(undefined);
    try { await createBillingPeriod(motelId, { month: Number(month), year: Number(year) }); setOpen(false); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo kỳ hóa đơn"); }
    finally { setPending(false); }
  }
  return <><Button onClick={() => setOpen(true)}>Tạo kỳ hóa đơn</Button><Modal open={open} onClose={() => setOpen(false)} title="Tạo kỳ hóa đơn" description="Kỳ mới sẽ tạo dòng chỉ số cho từng phòng."><form onSubmit={submit} className="space-y-4"><div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm text-text">Tháng<input required min="1" max="12" type="number" value={month} onChange={(e) => setMonth(e.target.value)} className="min-h-11 w-full rounded-input border border-border bg-surface px-3" /></label><label className="space-y-1 text-sm text-text">Năm<input required type="number" value={year} onChange={(e) => setYear(e.target.value)} className="min-h-11 w-full rounded-input border border-border bg-surface px-3" /></label></div>{error && <p role="alert" className="text-danger">{error}</p>}<div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang tạo…" : "Tạo kỳ"}</Button></div></form></Modal></>;
}
