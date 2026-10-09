import type { PaymentProof, PaymentProofStatus } from "@/lib/api/types";

export const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const PAYMENT_PROOF_TYPES = ["image/jpeg", "image/png"] as const;

export type PaymentProofFileResult = { ok: true } | { ok: false; error: string };

export function validatePaymentProofFile(file: File): PaymentProofFileResult {
  if (!PAYMENT_PROOF_TYPES.includes(file.type as (typeof PAYMENT_PROOF_TYPES)[number])) return { ok: false, error: "Chỉ nhận ảnh JPG hoặc PNG" };
  if (file.size === 0) return { ok: false, error: "Ảnh không có dữ liệu" };
  if (file.size > PAYMENT_PROOF_MAX_BYTES) return { ok: false, error: "Ảnh vượt quá giới hạn 10 MB" };
  return { ok: true };
}

export function paymentProofLabel(status: PaymentProofStatus): string {
  return status === "pending" ? "Đang chờ duyệt" : status === "approved" ? "Đã duyệt" : "Cần gửi lại";
}

export type PaymentProofView = PaymentProof & { signedUrl: string };
