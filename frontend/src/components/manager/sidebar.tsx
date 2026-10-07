import { Suspense } from "react";
import NavigationLink from "./navigation-link";

const destinations = [
  { href: "/", label: "Tổng quan" },
  { href: "/motels", label: "Nhà trọ" },
  { href: "/rooms", label: "Phòng trọ" },
  { href: "/renters", label: "Khách thuê" },
  { href: "/billing", label: "Tính tiền & Hóa đơn" },
] as const;

/** A Server Component: the four supported destinations are defined in one place. */
export default function Sidebar() {
  return (
    <>
      <aside aria-label="Thanh điều hướng" className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border bg-surface px-4 py-6 lg:block">
        <p className="mb-8 px-4 font-heading text-lg font-semibold text-text">Quản lý nhà trọ</p>
        <nav aria-label="Điều hướng chính" className="space-y-2">
          <Suspense fallback={<p role="status">Đang tải điều hướng…</p>}>
            {destinations.map(({ href, label }) => <NavigationLink key={href} href={href}>{label}</NavigationLink>)}
          </Suspense>
        </nav>
      </aside>
      <nav aria-label="Điều hướng chính trên điện thoại" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 gap-1 border-t border-border bg-surface px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden">
        <Suspense fallback={<p role="status" className="col-span-4">Đang tải điều hướng…</p>}>
          {destinations.map(({ href, label }) => <NavigationLink key={href} href={href} compact>{label}</NavigationLink>)}
        </Suspense>
      </nav>
    </>
  );
}
