"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { getRenterPaymentProof, submitRenterPaymentProof } from "@/lib/api/renter";
import type { PaymentProofStatus, RenterPaymentProof } from "@/lib/api/types";
import { paymentProofLabel, validatePaymentProofBytes } from "@/lib/payment-proof";

export default function PaymentProofPanel({ invoiceId, paymentStatus, paymentMethod }: { invoiceId: string; paymentStatus: "unpaid" | "paid" | "overdue"; paymentMethod?: "bank_transfer" | "cash" | null }) {
  const [proof, setProof] = useState<RenterPaymentProof | null>(null);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refreshProof = useCallback(async (signal?: AbortSignal) => { setLoading(true); setLoadFailed(false); try { const value = await getRenterPaymentProof(invoiceId); if (!signal?.aborted) setProof(value); } catch { if (!signal?.aborted) { setLoadFailed(true); setError("Không thể tải trạng thái chứng từ"); } } finally { if (!signal?.aborted) setLoading(false); } }, [invoiceId]);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => void refreshProof(controller.signal)); return () => controller.abort(); }, [refreshProof]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (loading || loadFailed) return <section aria-labelledby="payment-proof-title" className="space-y-3 rounded-card border border-border bg-surface p-5"><h2 id="payment-proof-title" className="font-heading text-lg font-semibold text-text">Chứng từ thanh toán</h2>{loading ? <p role="status" className="text-sm text-text-muted">Đang tải trạng thái chứng từ…</p> : <><p role="alert" className="text-sm text-danger">Không thể tải trạng thái chứng từ</p><button type="button" onClick={() => void refreshProof()} className="min-h-11 rounded-input border border-border px-4 py-2 font-semibold text-primary">Thử lại</button></>}</section>;
  if (paymentStatus === "paid") return <section aria-labelledby="payment-proof-title" className="space-y-3 rounded-card border border-border bg-surface p-5"><h2 id="payment-proof-title" className="font-heading text-lg font-semibold text-text">Thanh toán</h2><p className="text-sm text-text-muted">Hóa đơn đã thanh toán{paymentMethod === "cash" ? " bằng tiền mặt" : ""}. Không cần gửi thêm chứng từ.</p>{proof?.signedUrl && <Image src={proof.signedUrl} alt="Chứng từ thanh toán đã duyệt" width={640} height={480} unoptimized className="max-h-64 w-full rounded-input object-contain" />}</section>;

  async function choose(next: File | undefined) { setError(undefined); setFile(undefined); if (preview) URL.revokeObjectURL(preview); setPreview(undefined); if (!next) return; const result = await validatePaymentProofBytes(next); if (!result.ok) { setError(result.error); return; } setFile(next); setPreview(URL.createObjectURL(next)); }
  async function submit() { if (!file || pending) return; setPending(true); setError(undefined); try { await submitRenterPaymentProof(invoiceId, file); await refreshProof(); setFile(undefined); if (preview) URL.revokeObjectURL(preview); setPreview(undefined); } catch (cause) { setError(cause instanceof ApiError ? cause.message : "Không thể gửi chứng từ. Vui lòng thử lại."); } finally { setPending(false); } }
  const status: PaymentProofStatus | undefined = proof?.status;
  const rejectionReason = proof?.rejectionReason;
  const canReplace = status === "rejected";
  return <section aria-labelledby="payment-proof-title" className="space-y-4 rounded-card border border-border bg-surface p-5"><div><h2 id="payment-proof-title" className="font-heading text-lg font-semibold text-text">Chứng từ chuyển khoản</h2><p className="mt-1 text-sm text-text-muted">Gửi một ảnh JPG hoặc PNG, tối đa 10 MB. Chủ nhà sẽ kiểm tra và xác nhận.</p></div>{status && <div role="status" className="rounded-input bg-canvas p-3 text-sm"><p className="font-semibold text-text">{paymentProofLabel(status)}</p>{status === "rejected" && rejectionReason && <p className="mt-1 text-text-muted">Lý do: {rejectionReason}</p>}</div>}{proof?.signedUrl && <Image src={proof.signedUrl} alt="Ảnh chứng từ đã gửi" width={640} height={480} unoptimized className="max-h-64 w-full rounded-input object-contain" />}{(!status || canReplace) && <><label htmlFor="payment-proof-file" className="block text-sm font-semibold text-text">{canReplace ? "Chọn ảnh thay thế" : "Chọn ảnh chứng từ"}</label><input id="payment-proof-file" type="file" accept="image/jpeg,image/png" capture="environment" onChange={(event) => { void choose(event.target.files?.[0]); }} disabled={pending} className="block min-h-11 w-full rounded-input border border-border p-2 text-sm" />{preview && <Image src={preview} alt="Xem trước ảnh chứng từ" width={640} height={480} unoptimized className="max-h-64 w-full rounded-input object-contain" />}<button type="button" onClick={() => void submit()} disabled={!file || pending} className="min-h-11 w-full rounded-input bg-primary px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Đang gửi…" : "Gửi chứng từ"}</button></>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}</section>;
}
