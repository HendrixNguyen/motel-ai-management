"use client";

import { useState } from "react";
import Image from "next/image";
import NavigationLink from "./navigation-link";
import BottomNav from "@/components/ui/bottom-nav";

function OverviewIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function MotelsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
    </svg>
  );
}

function RoomsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16" />
      <path d="M14 12v.01" />
      <path d="M2 21h20" />
    </svg>
  );
}

function RentersIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BillingIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}

function CollapseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ExpandIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

const primaryDestinations = [
  { href: "/", label: "Tổng quan", icon: OverviewIcon },
  { href: "/motels", label: "Nhà trọ", icon: MotelsIcon },
  { href: "/rooms", label: "Phòng trọ", icon: RoomsIcon },
  { href: "/renters", label: "Khách thuê", icon: RentersIcon },
  { href: "/billing", label: "Tính tiền & Hóa đơn", icon: BillingIcon },
] as const;

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("motel-sidebar-collapsed") === "true";
      } catch {}
    }
    return false;
  });

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("motel-sidebar-collapsed", String(next));
      } catch {}
      return next;
    });
  };

  return (
    <>
      <aside
        aria-label="Thanh điều hướng"
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col justify-between border-r border-border bg-surface py-6 transition-[width,padding] duration-200 lg:flex ${
          collapsed ? "w-20 px-2" : "w-60 px-4"
        }`}
      >
        <div>
          <div className={`mb-8 flex items-center ${collapsed ? "justify-center" : "gap-3 px-2"}`}>
            <Image src="/brand/logo-mark.svg" alt="Nhà Số Gọn" width={32} height={32} className="h-8 w-8 shrink-0" />
            {!collapsed && (
              <span className="truncate font-heading text-lg font-bold tracking-tight text-text">
                Nhà Số Gọn
              </span>
            )}
          </div>

          <nav aria-label="Điều hướng chính" className="space-y-1">
            {primaryDestinations.map(({ href, label, icon: Icon }) => (
              <NavigationLink key={href} href={href} label={label} collapsed={collapsed}>
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </NavigationLink>
            ))}
          </nav>
        </div>

        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
            title={collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
            className={`flex min-h-11 w-full min-w-0 items-center rounded-input font-semibold text-text-muted transition-colors duration-150 hover:bg-canvas hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              collapsed ? "justify-center p-2 text-base" : "gap-3 px-4 py-2 text-base"
            }`}
          >
            {collapsed ? <ExpandIcon className="h-5 w-5 shrink-0" /> : <CollapseIcon className="h-5 w-5 shrink-0" />}
            {!collapsed && <span className="truncate">Thu gọn</span>}
          </button>
        </div>
      </aside>

      <BottomNav>
        <div aria-label="Điều hướng gọn trên điện thoại" className="grid grid-cols-5 gap-1">
          {primaryDestinations.map(({ href, label, icon: Icon }) => (
            <NavigationLink key={href} href={href} compact label={label}>
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label === "Tính tiền & Hóa đơn" ? "Hóa đơn" : label}</span>
            </NavigationLink>
          ))}
        </div>
      </BottomNav>
    </>
  );
}
