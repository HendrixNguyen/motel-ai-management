import Image from "next/image";
import NavigationLink from "./navigation-link";
import BottomNav from "@/components/ui/bottom-nav";

const primaryDestinations = [
  { href: "/", label: "Tổng quan", icon: "01" },
  { href: "/motels", label: "Nhà trọ", icon: "02" },
  { href: "/rooms", label: "Phòng trọ", icon: "03" },
  { href: "/renters", label: "Khách thuê", icon: "04" },
  { href: "/billing", label: "Tính tiền & Hóa đơn", icon: "05" },
] as const;
export default function Sidebar() {
  return <><aside aria-label="Thanh điều hướng" className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border bg-surface px-4 py-6 lg:block"><div className="mb-8 px-4"><Image src="/brand/logo.svg" alt="Nhà Số Gọn" width={160} height={40} className="h-10 w-auto" /></div><nav aria-label="Điều hướng chính" className="space-y-1">{primaryDestinations.map(({ href, label, icon }) => <NavigationLink key={href} href={href}><span aria-hidden="true" className="w-7 text-center text-xs font-bold tabular-nums text-current/70">{icon}</span>{label}</NavigationLink>)}</nav></aside><BottomNav><div aria-label="Điều hướng gọn trên điện thoại" className="grid grid-cols-5 gap-1">{primaryDestinations.map(({ href, label, icon }) => <NavigationLink key={href} href={href} compact label={label}><span aria-hidden="true" className="text-xs font-bold tabular-nums text-current/70">{icon}</span><span>{label === "Tính tiền & Hóa đơn" ? "Hóa đơn" : label}</span></NavigationLink>)}</div></BottomNav></>;
}
