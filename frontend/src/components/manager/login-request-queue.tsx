"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { apiGet, apiSend } from "@/lib/api/client";
import { formatPhone } from "@/lib/format/phone";

interface LoginRequest { id: string; renterId: string; renterName: string; renterPhone: string; requestedAt: string }

export default function LoginRequestQueue({ motelId }: { motelId: string }) {
  const [requests, setRequests] = useState<LoginRequest[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  async function refresh() { try { setRequests(await apiGet<LoginRequest[]>(`/api/manager/motels/${encodeURIComponent(motelId)}/login-requests`)); setError(""); } catch (cause) { setError(cause instanceof ApiError ? cause.message : "Không thể tải yêu cầu đăng nhập."); } }
  useEffect(() => {
    let active = true;
    void apiGet<LoginRequest[]>(`/api/manager/motels/${encodeURIComponent(motelId)}/login-requests`)
      .then((data) => { if (active) { setRequests(data); setError(""); } })
      .catch((cause) => { if (active) setError(cause instanceof ApiError ? cause.message : "Không thể tải yêu cầu đăng nhập."); });
    void apiGet<string>(`/api/manager/motels/${encodeURIComponent(motelId)}/renter-recovery/code`)
      .then((data) => { if (active) setCode(data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [motelId]);
  async function issue(request: LoginRequest) {
    setBusy(request.id); setError("");
    try {
      const { url } = await apiSend<{ token: string; url: string }>(`/api/manager/motels/${encodeURIComponent(motelId)}/login-requests/${encodeURIComponent(request.id)}/link`, "POST");
      await navigator.clipboard.writeText(`Xin chào ${request.renterName}, đây là liên kết đăng nhập cổng khách thuê (hết hạn sau 24 giờ): ${url}`);
      window.open(`https://zalo.me/${request.renterPhone}`, "_blank", "noopener,noreferrer");
      await apiSend(`/api/manager/motels/${encodeURIComponent(motelId)}/login-requests/${encodeURIComponent(request.id)}/handled`, "POST");
      await refresh();
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : "Không thể hoàn tất. Hãy sao chép/gửi liên kết thủ công rồi đánh dấu đã xử lý."); }
    finally { setBusy(undefined); }
  }
  async function dismiss(requestId: string) { setBusy(requestId); try { await apiSend(`/api/manager/motels/${encodeURIComponent(motelId)}/login-requests/${encodeURIComponent(requestId)}/dismiss`, "POST"); await refresh(); } catch { setError("Không thể đóng yêu cầu."); } finally { setBusy(undefined); } }
  return <section className="space-y-3 rounded-card border border-border bg-surface p-4"><h2 className="font-heading text-lg font-semibold text-text">Yêu cầu đăng nhập</h2>{code && <p className="break-all text-sm text-text-muted">Mã nhà trọ để chia sẻ với khách: <span className="font-mono">{code}</span></p>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}{requests.length ? requests.map((request) => <article key={request.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><div><p className="font-semibold">{request.renterName}</p><a href={`tel:+${request.renterPhone}`} className="text-sm text-primary underline">{formatPhone(request.renterPhone)}</a></div><div className="flex gap-2"><Button size="sm" pending={busy === request.id} onClick={() => void issue(request)}>Tạo link, mở Zalo</Button><Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void dismiss(request.id)}>Đóng</Button></div></article>) : <p className="text-sm text-text-muted">Chưa có yêu cầu đang chờ.</p>}</section>;
}
