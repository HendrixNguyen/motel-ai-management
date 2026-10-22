export const PAYMENT_PROOF_SOURCE_MAX_BYTES = 20_000_000;
export const PAYMENT_PROOF_MAX_BYTES = 5_000_000;
export const PAYMENT_PROOF_TYPES = ["image/jpeg", "image/png"] as const;
export const PAYMENT_PROOF_SOURCE_TYPES = [...PAYMENT_PROOF_TYPES, "image/webp", "image/heic", "image/heif"] as const;
export type PaymentProofStatus = "pending" | "approved" | "rejected";
export type PaymentProof = { id: string; invoiceId: string; status: PaymentProofStatus; contentType: "image/jpeg" | "image/png"; size: number; submittedAt: string; reviewedAt: string | null; rejectionReason: string | null };

export type PaymentProofFileResult = { ok: true } | { ok: false; error: string };

export function validatePaymentProofFile(file: File): PaymentProofFileResult {
  if (!(PAYMENT_PROOF_SOURCE_TYPES as readonly string[]).includes(file.type)) return { ok: false, error: "Chỉ nhận ảnh JPEG, PNG, WebP hoặc HEIC" };
  if (file.size === 0) return { ok: false, error: "Ảnh không có dữ liệu" };
  if (file.size > PAYMENT_PROOF_SOURCE_MAX_BYTES) return { ok: false, error: "Ảnh vượt quá giới hạn 20 MB" };
  if (PAYMENT_PROOF_TYPES.includes(file.type as (typeof PAYMENT_PROOF_TYPES)[number]) && file.size > PAYMENT_PROOF_MAX_BYTES) return { ok: false, error: "Ảnh vượt quá giới hạn 5 MB" };
  return { ok: true };
}

export async function validatePaymentProofBytes(file: File): Promise<PaymentProofFileResult> {
  if (!PAYMENT_PROOF_TYPES.includes(file.type as (typeof PAYMENT_PROOF_TYPES)[number]) || file.size === 0 || file.size > PAYMENT_PROOF_MAX_BYTES) return { ok: false, error: "Tệp chứng từ không hợp lệ" };
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && bytes.every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  if ((file.type === "image/jpeg" && !jpeg) || (file.type === "image/png" && !png)) return { ok: false, error: "Nội dung ảnh không hợp lệ" };
  return { ok: true };
}

export function paymentProofLabel(status: PaymentProofStatus): string {
  return status === "pending" ? "Đang chờ duyệt" : status === "approved" ? "Đã duyệt" : "Cần gửi lại";
}

export type PaymentProofView = PaymentProof & { signedUrl: string };
