import { Suspense } from "react";
import NavigationLink from "./navigation-link";

const primaryDestinations = [
  { href: "/", label: "Tổng quan", icon: "01" },
  { href: "/motels", label: "Nhà trọ", icon: "02" },
  { href: "/rooms", label: "Phòng trọ", icon: "03" },
  { href: "/renters", label: "Khách thuê", icon: "04" },
  { href: "/billing", label: "Tính tiền & Hóa đơn", icon: "05" },
] as const;
export default function Sidebar() {
  return <><aside aria-label="Thanh điều hướng" className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border bg-surface px-4 py-6 lg:block"><div className="mb-8 px-4"><p className="font-heading text-lg font-semibold text-text">Quản lý nhà trọ</p><p className="mt-1 text-xs text-text-muted">Vận hành rõ ràng mỗi ngày</p></div><nav aria-label="Điều hướng chính" className="space-y-1"><Suspense fallback={<p role="status">Đang tải điều hướng…</p>}>{primaryDestinations.map(({ href, label, icon }) => <NavigationLink key={href} href={href}><span aria-hidden="true" className="w-7 text-center text-xs font-bold tabular-nums text-current/70">{icon}</span>{label}</NavigationLink>)}</Suspense></nav></aside><nav aria-label="Điều hướng chính trên điện thoại" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 gap-1 border-t border-border bg-surface px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden"><Suspense fallback={<p role="status" className="col-span-4">Đang tải điều hướng…</p>}>{primaryDestinations.map(({ href, label, icon }) => <NavigationLink key={href} href={href} compact><span aria-hidden="true" className="text-xs font-bold tabular-nums text-current/70">{icon}</span><span>{label}</span></NavigationLink>)}</Suspense></nav></>;
}
