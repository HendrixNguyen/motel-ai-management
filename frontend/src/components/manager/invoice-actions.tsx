"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { ApiError } from "@/lib/api/client";
import { approvePaymentProof, confirmInvoiceCash, getManagerPaymentProof, markInvoiceOverdue, rejectPaymentProof } from "@/lib/api/billing.client";
import Button from "@/components/ui/button";
import type { InvoiceResponse, ManagerPaymentProof } from "@/lib/api/types";
import { paymentProofLabel } from "@/lib/payment-proof";

export default function InvoiceActions({ motelId, invoice, bankAccount }: { motelId: string; invoice: InvoiceResponse; bankAccount: { bankCode: string; accountNumber: string; accountName: string } | null }) {
  const [pending, setPending] = useState(false); const [message, setMessage] = useState<string>(); const [proof, setProof] = useState<ManagerPaymentProof | null>(); const [proofLoading, setProofLoading] = useState(true); const [reason, setReason] = useState(""); const canvas = useRef<HTMLCanvasElement>(null); const router = useRouter();
  const refreshProof = useCallback(async (signal?: AbortSignal) => { setProofLoading(true); try { const current = await getManagerPaymentProof(motelId, invoice.id); if (!signal?.aborted) setProof(current); } catch (cause) { if (!signal?.aborted) { setProof(undefined); setMessage(cause instanceof Error ? cause.message : "Không thể tải chứng từ"); } } finally { if (!signal?.aborted) setProofLoading(false); } }, [invoice.id, motelId]);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => void refreshProof(controller.signal)); return () => controller.abort(); }, [refreshProof]);
  useEffect(() => { if (!invoice.qrCodeData || !canvas.current) return; void QRCode.toCanvas(canvas.current, invoice.qrCodeData, { width: 220, margin: 2 }); }, [invoice.qrCodeData]);

  async function transition(action: "approve" | "reject" | "cash" | "overdue") {
    if (pending || (action === "reject" && !reason.trim())) return;
    if (action === "cash" && !window.confirm("Xác nhận đã nhận tiền mặt cho hóa đơn này?")) return;
    setPending(true); setMessage(undefined);
    try {
      if (action === "approve") { const result = await approvePaymentProof(motelId, invoice.id); setMessage(`Đã ghi nhận thanh toán qua chuyển khoản. Trạng thái: ${result.paymentStatus}.`); }
      else if (action === "reject") { await rejectPaymentProof(motelId, invoice.id, reason); setMessage("Chứng từ đã bị từ chối. Hóa đơn vẫn chưa thanh toán."); setReason(""); }
      else if (action === "cash") { const result = await confirmInvoiceCash(motelId, invoice.id); setMessage(`Đã xác nhận thanh toán bằng tiền mặt. Trạng thái: ${result.paymentStatus}.`); }
      else { await markInvoiceOverdue(motelId, invoice.id); setMessage("Đã đánh dấu quá hạn"); }
      await refreshProof(); router.refresh();
    } catch (cause) {
      setMessage(cause instanceof ApiError && cause.status === 409 ? "Trạng thái hóa đơn đã thay đổi. Đang tải lại dữ liệu mới nhất." : cause instanceof Error ? cause.message : "Không thể cập nhật");
      if (cause instanceof ApiError && cause.status === 409) { await refreshProof(); router.refresh(); }
    } finally { setPending(false); }
  }

  return <div className="mt-4 flex min-w-0 flex-wrap items-start gap-2">
    {invoice.qrCodeData ? <details><summary className="min-h-11 cursor-pointer rounded-input px-3 py-2 font-semibold text-primary underline">Xem mã QR</summary><div className="mt-2 rounded-input bg-surface p-2"><canvas ref={canvas} role="img" aria-label={`Mã QR thanh toán hóa đơn phòng ${invoice.roomName}`} /><dl className="max-w-[240px] space-y-1 text-sm text-text"><div><dt className="text-text-muted">Người nhận</dt><dd>{bankAccount?.accountName ?? "Chưa cấu hình"}</dd></div><div><dt className="text-text-muted">Số tài khoản</dt><dd>{bankAccount?.accountNumber ?? "Chưa cấu hình"}</dd></div><div><dt className="text-text-muted">Số tiền</dt><dd>{invoice.totalAmount} ₫</dd></div><p className="break-all text-xs text-text-muted">Payload: {invoice.qrCodeData}</p></dl></div></details> : <span className="text-sm text-text-muted">Chưa có mã QR</span>}
    {proofLoading ? <p role="status" className="w-full text-sm text-text-muted">Đang tải chứng từ…</p> : proof === undefined ? <div className="w-full space-y-2"><p role="alert" className="text-sm text-danger">Không thể tải chứng từ.</p><Button variant="ghost" onClick={() => void refreshProof()} disabled={pending}>Tải lại chứng từ</Button></div> : proof && <section aria-label="Chứng từ thanh toán" className="w-full space-y-3 rounded-input border border-border bg-canvas p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-text">Chứng từ chuyển khoản</h3><span role="status" className="text-sm text-text-muted">{paymentProofLabel(proof.status)}</span></div><Image src={proof.signedUrl} alt="Chứng từ thanh toán" width={640} height={480} unoptimized className="max-h-64 w-full rounded-input object-contain" /><p className="break-words text-sm text-text-muted">Gửi lúc {new Date(proof.submittedAt).toLocaleString("vi-VN")}</p>{proof.rejectionReason && <p className="break-words text-sm text-danger">Lý do từ chối: {proof.rejectionReason}</p>}{invoice.paymentStatus !== "paid" && proof.status === "pending" && <div className="flex min-w-0 flex-wrap gap-2"><label className="w-full text-sm font-semibold text-text" htmlFor={`reject-reason-${invoice.id}`}>Lý do từ chối</label><textarea id={`reject-reason-${invoice.id}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required disabled={pending} className="min-h-20 w-full min-w-0 rounded-input border border-border p-3 text-text" /><Button variant="danger" onClick={() => void transition("reject")} disabled={pending || !reason.trim()}>Từ chối chứng từ</Button><Button onClick={() => void transition("approve")} disabled={pending}>Duyệt chứng từ</Button></div>}</section>}
    {invoice.paymentStatus !== "paid" && <Button variant="secondary" onClick={() => void transition("cash")} disabled={pending}>Xác nhận đã nhận tiền mặt</Button>}
    {invoice.paymentStatus === "unpaid" && <Button variant="ghost" onClick={() => void transition("overdue")} disabled={pending}>Đánh dấu quá hạn</Button>}
    {message && <span role={message.includes("thay đổi") ? "alert" : "status"} className="max-w-full break-words text-sm text-text-muted">{message}</span>}
  </div>;
}
