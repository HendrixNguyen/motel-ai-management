"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { exchangeRenterMagicLink } from "@/lib/api/renter";

export default function RenterTokenPage() {
  const { token } = useParams<{ token: string }>(); const router = useRouter(); const [errorCode, setErrorCode] = useState<string | null>(null);
  useEffect(() => { void exchangeRenterMagicLink(token).then(() => router.replace("/portal")).catch((cause) => { setErrorCode(cause instanceof ApiError ? cause.code : "INTERNAL_ERROR"); }); }, [router, token]);
  return <main className="mx-auto flex min-h-dvh w-full max-w-[480px] items-center px-4"><section className="w-full space-y-4 rounded-card border border-border bg-surface p-6" role={errorCode ? "alert" : "status"}><h1 className="font-heading text-2xl font-bold text-text">{errorCode ? ({ MAGIC_LINK_EXPIRED: "Liên kết đã hết hạn", UNAUTHORIZED: "Liên kết không hợp lệ", NOT_FOUND: "Không tìm thấy liên kết", RATE_LIMITED: "Bạn đã yêu cầu quá nhiều lần" }[errorCode] ?? "Không thể mở liên kết") : "Đang xác thực…"}</h1>{errorCode && <p className="text-base text-text-muted">{errorCode === "RATE_LIMITED" ? "Vui lòng thử lại sau vài phút." : errorCode === "MAGIC_LINK_EXPIRED" ? "Hãy nhắn chủ nhà gửi liên kết mới qua Zalo." : "Hãy kiểm tra liên kết hoặc xin chủ nhà gửi liên kết mới."}</p>}</section></main>;
}
