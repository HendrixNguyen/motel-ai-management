"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { exchangeRenterMagicLink } from "@/lib/api/renter";
import Button from "@/components/ui/button";
import Field from "@/components/ui/field";

export default function RenterExchangeForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setPending(true);
    try { await exchangeRenterMagicLink(token.trim()); router.replace("/renter/home"); }
    catch (cause) { setError(cause instanceof ApiError && cause.code === "MAGIC_LINK_EXPIRED" ? "Liên kết đã hết hạn. Hãy xin chủ nhà gửi liên kết mới." : cause instanceof ApiError ? cause.message : "Đã xảy ra lỗi hệ thống"); setPending(false); }
  }
  return <form onSubmit={submit} className="w-full space-y-5 rounded-card border border-border bg-surface p-6 shadow-sm"><div><h1 className="font-heading text-2xl font-bold text-text">Cổng khách thuê</h1><p className="mt-2 text-base text-text-muted">Mở liên kết đăng nhập từ chủ nhà để xem hóa đơn và hợp đồng.</p></div><Field id="token" label="Mã liên kết" error={error}>{(props) => <input {...props} value={token} onChange={(event) => setToken(event.target.value)} autoComplete="one-time-code" required />}</Field><Button type="submit" pending={pending} pendingLabel="Đang đăng nhập…">Đăng nhập</Button></form>;
}
