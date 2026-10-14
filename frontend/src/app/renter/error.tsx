"use client";

import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";

export default function RenterError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const expired = error instanceof ApiError && error.code === "MAGIC_LINK_EXPIRED";
  return <main className="mx-auto flex min-h-dvh w-full max-w-[480px] items-center px-4"><section className="w-full space-y-4 rounded-card border border-danger bg-danger-bg p-6" role="alert"><h1 className="font-heading text-xl font-bold text-text">{expired ? "Liên kết đã hết hạn" : "Không thể tải dữ liệu"}</h1><p className="text-base text-text-body">{expired ? "Hãy xin chủ nhà gửi liên kết mới." : error instanceof ApiError ? error.message : "Đã xảy ra lỗi hệ thống"}</p><div className="flex flex-wrap gap-3"><button className="min-h-11 rounded-input bg-primary px-4 py-2.5 font-semibold text-surface" onClick={reset}>Thử lại</button>{expired && <button className="min-h-11 rounded-input border border-border-strong bg-surface px-4 py-2.5 font-semibold text-primary" onClick={() => router.push("/renter")}>Đăng nhập lại</button>}</div></section></main>;
}
