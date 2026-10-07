"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { markInvoiceOverdue, markInvoicePaid } from "@/lib/api/billing.client";
import Button from "@/components/ui/button";
import type { InvoiceResponse } from "@/lib/api/types";

export default function InvoiceActions({ motelId, invoice }: { motelId: string; invoice: InvoiceResponse }) {
  const [pending, setPending] = useState(false); const [message, setMessage] = useState<string>(); const canvas = useRef<HTMLCanvasElement>(null); const router = useRouter();
  useEffect(() => { if (!invoice.qrCodeData || !canvas.current) return; void QRCode.toCanvas(canvas.current, invoice.qrCodeData, { width: 220, margin: 2 }); }, [invoice.qrCodeData]);
  async function transition(action: "paid" | "overdue") { if (pending) return; if (!window.confirm(action === "paid" ? "Xác nhận hóa đơn đã thanh toán?" : "Đánh dấu hóa đơn quá hạn?")) return; setPending(true); setMessage(undefined); try { const updated = action === "paid" ? await markInvoicePaid(motelId, invoice.id) : await markInvoiceOverdue(motelId, invoice.id); setMessage(updated.paymentStatus === "paid" ? "Đã ghi nhận thanh toán" : "Đã đánh dấu quá hạn"); router.refresh(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Không thể cập nhật"); } finally { setPending(false); } }
  return <div className="mt-4 flex flex-wrap items-center gap-2">{invoice.qrCodeData ? <details><summary className="min-h-11 cursor-pointer rounded-input px-3 py-2 font-semibold text-primary underline">Xem mã QR</summary><div className="mt-2 rounded-input bg-surface p-2"><canvas ref={canvas} role="img" aria-label={`Mã QR thanh toán hóa đơn phòng ${invoice.roomName}`} /><p className="max-w-[220px] break-all text-xs text-text-muted">{invoice.qrCodeData}</p></div></details> : <span className="text-sm text-text-muted">Chưa có mã QR</span>}{invoice.paymentStatus !== "paid" && <Button variant="secondary" onClick={() => transition("paid")} disabled={pending}>Xác nhận đã thanh toán</Button>}{invoice.paymentStatus === "unpaid" && <Button variant="ghost" onClick={() => transition("overdue")} disabled={pending}>Đánh dấu quá hạn</Button>}{message && <span role="status" className="text-sm text-text-muted">{message}</span>}</div>;
}
