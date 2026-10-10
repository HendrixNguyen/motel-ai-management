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

export async function validatePaymentProofBytes(file: File): Promise<PaymentProofFileResult> {
  const basic = validatePaymentProofFile(file); if (!basic.ok) return basic;
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length === 8 && bytes.every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  if ((file.type === "image/jpeg" && !jpeg) || (file.type === "image/png" && !png)) return { ok: false, error: "Nội dung ảnh không hợp lệ" };
  return { ok: true };
}

export function paymentProofLabel(status: PaymentProofStatus): string {
  return status === "pending" ? "Đang chờ duyệt" : status === "approved" ? "Đã duyệt" : "Cần gửi lại";
}

export type PaymentProofView = PaymentProof & { signedUrl: string };
