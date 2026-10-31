import { PAYMENT_PROOF_MAX_BYTES, PAYMENT_PROOF_TYPES, validatePaymentProofBytes, validatePaymentProofFile } from "@/lib/payment-proof";

const MAX_PIXELS = 40_000_000;
const MAX_SIDE = 4096;

function decodeImage(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") return Promise.reject(new Error("Thiết bị hoặc trình duyệt không hỗ trợ ảnh HEIC này. Hãy xuất ảnh sang JPEG/PNG hoặc chụp màn hình giao dịch."));
  return createImageBitmap(file).catch(() => { throw new Error("Thiết bị hoặc trình duyệt không hỗ trợ ảnh HEIC này. Hãy xuất ảnh sang JPEG/PNG hoặc chụp màn hình giao dịch."); });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không thể chuyển đổi ảnh. Hãy chọn JPEG hoặc PNG.")), "image/jpeg", quality));
}

export async function convertPaymentProofImage(file: File): Promise<File> {
  const validation = validatePaymentProofFile(file);
  if (!validation.ok) throw new Error(validation.error);
  if (PAYMENT_PROOF_TYPES.includes(file.type as (typeof PAYMENT_PROOF_TYPES)[number])) {
    const valid = await validatePaymentProofBytes(file);
    if (!valid.ok) throw new Error(valid.error);
    return file;
  }
  const bitmap = await decodeImage(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_PIXELS) throw new Error("Ảnh quá lớn sau khi giải mã (tối đa 40 megapixel).");
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
    canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Không thể xử lý ảnh trên thiết bị này.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.92, 0.84, 0.76, 0.68, 0.6]) {
      const blob = await canvasBlob(canvas, quality);
      if (blob.size <= PAYMENT_PROOF_MAX_BYTES) {
        const converted = new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "chung-tu"}.jpg`, { type: "image/jpeg" });
        const valid = await validatePaymentProofBytes(converted);
        if (!valid.ok) throw new Error(valid.error);
        return converted;
      }
    }
    throw new Error("Ảnh sau chuyển đổi vẫn vượt quá 5 MB. Hãy giảm kích thước rồi thử lại.");
  } finally {
    bitmap.close();
  }
}

export const PAYMENT_PROOF_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
