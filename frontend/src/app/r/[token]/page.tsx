"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { exchangeRenterMagicLink } from "@/lib/api/renter";

export default function RenterTokenPage() {
  const { token } = useParams<{ token: string }>(); const router = useRouter(); const [error, setError] = useState(false);
  useEffect(() => { void exchangeRenterMagicLink(token).then(() => router.replace("/portal")).catch((cause) => { setError(cause instanceof ApiError && ["MAGIC_LINK_EXPIRED", "UNAUTHORIZED", "NOT_FOUND", "RATE_LIMITED"].includes(cause.code)); }); }, [router, token]);
  return <main className="mx-auto flex min-h-dvh w-full max-w-[480px] items-center px-4"><section className="w-full space-y-4 rounded-card border border-border bg-surface p-6" role={error ? "alert" : "status"}><h1 className="font-heading text-2xl font-bold text-text">{error ? "Liên kết đã hết hạn" : "Đang xác thực…"}</h1>{error && <p className="text-base text-text-muted">Hãy nhắn chủ nhà gửi liên kết mới qua Zalo.</p>}</section></main>;
}
