"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export default function InvoiceQr({ payload }: { payload: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (canvas.current) void QRCode.toCanvas(canvas.current, payload, { width: 220, margin: 2 }); }, [payload]);
  return <div className="rounded-input border border-border bg-surface p-3"><p className="font-semibold text-text">Quét mã VietQR để chuyển khoản</p><canvas ref={canvas} role="img" aria-label="Mã QR thanh toán hóa đơn" className="mx-auto mt-3 max-w-full" /></div>;
}
