"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { exchangeRenterMagicLink, requestRenterLogin } from "@/lib/api/renter";
import Button from "@/components/ui/button";
import Field from "@/components/ui/field";

export default function RenterExchangeForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [motelCode, setMotelCode] = useState("");
  const [phone, setPhone] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setPending(true);
    try { await exchangeRenterMagicLink(token.trim()); router.replace("/portal"); }
    catch (cause) { setError(cause instanceof ApiError ? (cause.code === "MAGIC_LINK_EXPIRED" ? "Liên kết đã hết hạn. Hãy xin chủ nhà gửi liên kết mới." : cause.code === "UNAUTHORIZED" ? "Liên kết không hợp lệ. Hãy xin chủ nhà gửi liên kết mới." : cause.code === "NOT_FOUND" ? "Không tìm thấy liên kết. Hãy xin chủ nhà gửi liên kết mới." : cause.code === "RATE_LIMITED" ? "Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau." : cause.message) : "Đã xảy ra lỗi hệ thống"); setPending(false); }
  }
  async function requestLink(event: React.FormEvent) {
    event.preventDefault(); setError(""); setPending(true);
    try { const result = await requestRenterLogin(motelCode.trim(), phone.trim()); setRequestSent(true); setError(result.message); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Không thể gửi yêu cầu. Vui lòng thử lại."); }
    finally { setPending(false); }
  }
  return <div className="w-full space-y-5"><form onSubmit={submit} className="space-y-5 rounded-card border border-border bg-surface p-6 shadow-sm"><div><h1 className="font-heading text-2xl font-bold text-text">Cổng khách thuê</h1><p className="mt-2 text-base text-text-muted">Mở liên kết đăng nhập từ chủ nhà để xem hóa đơn và hợp đồng.</p></div><Field id="token" label="Mã liên kết" error={error && !requestSent ? error : undefined}>{(props) => <input {...props} value={token} onChange={(event) => setToken(event.target.value)} autoComplete="one-time-code" required />}</Field><Button type="submit" pending={pending} pendingLabel="Đang đăng nhập…">Đăng nhập</Button></form><form onSubmit={requestLink} className="space-y-4 rounded-card border border-border bg-surface p-6"><div><h2 className="font-heading text-lg font-semibold text-text">Hết hạn hoặc chưa có liên kết?</h2><p className="mt-1 text-sm text-text-muted">Nhập mã nhà trọ và số điện thoại. Chủ nhà xem yêu cầu rồi gửi liên kết qua Zalo.</p></div><Field id="motel-code" label="Mã nhà trọ">{(props) => <input {...props} value={motelCode} onChange={(event) => setMotelCode(event.target.value)} required minLength={20} autoComplete="off" />}</Field><Field id="recovery-phone" label="Số điện thoại" error={error && !requestSent ? error : undefined}>{(props) => <input {...props} value={phone} onChange={(event) => setPhone(event.target.value)} required autoComplete="tel" inputMode="tel" />}</Field><Button type="submit" variant="secondary" pending={pending} pendingLabel="Đang gửi yêu cầu…">Yêu cầu gửi liên kết</Button>{requestSent && <p role="status" className="text-sm text-text-muted">{error}</p>}</form></div>;
}
