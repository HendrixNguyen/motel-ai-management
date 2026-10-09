"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export default function InvoiceQr({ payload }: { payload: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (canvas.current) void QRCode.toCanvas(canvas.current, payload, { width: 220, margin: 2 }); }, [payload]);
  return <div className="rounded-card border border-border bg-surface p-4 shadow-sm"><p className="font-heading text-lg font-semibold text-text">Thanh toán bằng VietQR</p><p className="mt-1 text-sm text-text-muted">Mở ứng dụng ngân hàng, quét mã và kiểm tra đúng số tiền trước khi chuyển.</p><div className="mt-4 rounded-input bg-white p-3"><canvas ref={canvas} role="img" aria-label="Mã QR thanh toán hóa đơn" className="mx-auto max-w-full" /></div></div>;
}
