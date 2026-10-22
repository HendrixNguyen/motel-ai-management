"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { getRenterPaymentProof, submitRenterPaymentProof } from "@/lib/api/renter";
import type { PaymentProofStatus, RenterPaymentProof } from "@/lib/api/types";
import { paymentProofLabel, PAYMENT_PROOF_SOURCE_MAX_BYTES } from "@/lib/payment-proof";
import { convertPaymentProofImage, PAYMENT_PROOF_ACCEPT } from "@/lib/payment-proof-image";
import ImagePreview from "@/components/ui/image-preview";
import FileUpload from "@/components/ui/file-upload";

export default function PaymentProofPanel({ invoiceId, paymentStatus, paymentMethod }: { invoiceId: string; paymentStatus: "unpaid" | "paid" | "overdue"; paymentMethod?: "bank_transfer" | "cash" | null }) {
  const [proof, setProof] = useState<RenterPaymentProof | null>(null);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const [uploadError, setUploadError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [converting, setConverting] = useState(false);
  const selectionId = useRef(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refreshProof = useCallback(async (signal?: AbortSignal) => { setLoading(true); setLoadFailed(false); try { const value = await getRenterPaymentProof(invoiceId); if (!signal?.aborted) setProof(value); } catch { if (!signal?.aborted) { setLoadFailed(true); setError("Không thể tải trạng thái chứng từ"); } } finally { if (!signal?.aborted) setLoading(false); } }, [invoiceId]);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => void refreshProof(controller.signal)); return () => controller.abort(); }, [refreshProof]);
  useEffect(() => () => { selectionId.current += 1; if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (loading || loadFailed) return <section aria-labelledby="payment-proof-title" className="space-y-3 rounded-card border border-border bg-surface p-5"><h2 id="payment-proof-title" className="font-heading text-lg font-semibold text-text">Chứng từ thanh toán</h2>{loading ? <p role="status" className="text-sm text-text-muted">Đang tải trạng thái chứng từ…</p> : <><p role="alert" className="text-sm text-danger">Không thể tải trạng thái chứng từ</p><button type="button" onClick={() => void refreshProof()} className="min-h-11 rounded-input border border-border px-4 py-2 font-semibold text-primary">Thử lại</button></>}</section>;
  if (paymentStatus === "paid") return <section aria-labelledby="payment-proof-title" className="space-y-3 rounded-card border border-border bg-surface p-5"><h2 id="payment-proof-title" className="font-heading text-lg font-semibold text-text">Thanh toán</h2><p className="text-sm text-text-muted">Hóa đơn đã thanh toán{paymentMethod === "cash" ? " bằng tiền mặt" : ""}. Không cần gửi thêm chứng từ.</p>{proof?.signedUrl && <ImagePreview src={proof.signedUrl} alt="Chứng từ thanh toán đã duyệt" />}</section>;

  async function choose(next: File | undefined) { const currentId = ++selectionId.current; setError(undefined); setFile(undefined); if (preview) URL.revokeObjectURL(preview); setPreview(undefined); if (!next) { setUploadError(undefined); return; } setConverting(true); try { const converted = await convertPaymentProofImage(next); if (currentId !== selectionId.current) return; setFile(converted); setPreview(URL.createObjectURL(converted)); } catch (cause) { if (currentId === selectionId.current) setError(cause instanceof Error ? cause.message : "Không thể xử lý ảnh."); } finally { if (currentId === selectionId.current) setConverting(false); } }
  async function submit() { if (!file || pending) return; setPending(true); setError(undefined); setUploadError(undefined); try { await submitRenterPaymentProof(invoiceId, file); await refreshProof(); setFile(undefined); if (preview) URL.revokeObjectURL(preview); setPreview(undefined); } catch (cause) { setError(cause instanceof ApiError ? cause.message : "Không thể gửi chứng từ. Vui lòng thử lại."); } finally { setPending(false); } }
  const status: PaymentProofStatus | undefined = proof?.status;
  const rejectionReason = proof?.rejectionReason;
  const canReplace = status === "rejected";
  return <section aria-labelledby="payment-proof-title" className="space-y-4 rounded-card border border-border bg-surface p-5"><div><h2 id="payment-proof-title" className="font-heading text-lg font-semibold text-text">Chứng từ chuyển khoản</h2><p className="mt-1 text-sm text-text-muted">Gửi một ảnh JPEG, PNG, WebP hoặc HEIC tối đa 20 MB. Ảnh WebP/HEIC được chuyển sang JPEG tối đa 5 MB khi trình duyệt hỗ trợ. Chủ nhà sẽ kiểm tra và xác nhận.</p></div>{status && <div role="status" className="rounded-input bg-canvas p-3 text-sm"><p className="font-semibold text-text">{paymentProofLabel(status)}</p>{status === "rejected" && rejectionReason && <p className="mt-1 text-text-muted">Lý do: {rejectionReason}</p>}</div>}{proof?.signedUrl && <ImagePreview src={proof.signedUrl} alt="Ảnh chứng từ đã gửi" />}{(!status || canReplace) && <><FileUpload id="payment-proof-file" label={canReplace ? "Ảnh chứng từ thay thế" : "Ảnh chứng từ"} maxBytes={PAYMENT_PROOF_SOURCE_MAX_BYTES} accept={PAYMENT_PROOF_ACCEPT} pending={pending || converting} previewUrl={preview} onRemovePreview={() => { setFile(undefined); if (preview) URL.revokeObjectURL(preview); setPreview(undefined); }} error={uploadError} onError={setUploadError} onFiles={(files) => { void choose(files[0]); }} /><button type="button" onClick={() => void submit()} disabled={!file || pending || converting} className="min-h-11 w-full rounded-input bg-primary px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{converting ? "Đang chuyển đổi ảnh…" : pending ? "Đang gửi…" : "Gửi chứng từ"}</button></>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}</section>;
}
