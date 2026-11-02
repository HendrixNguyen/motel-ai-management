"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import NavigationLink from "./navigation-link";
import BottomNav from "@/components/ui/bottom-nav";

type IconName =
  "overview" | "home" | "rooms" | "renters" | "billing" | "contracts" | "managers" | "more";
const destinations: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Tổng quan", icon: "overview" },
  { href: "/motels", label: "Nhà trọ", icon: "home" },
  { href: "/rooms", label: "Phòng trọ", icon: "rooms" },
  { href: "/renters", label: "Khách thuê", icon: "renters" },
  { href: "/billing", label: "Tính tiền & Hóa đơn", icon: "billing" },
  { href: "/contracts", label: "Hợp đồng", icon: "contracts" },
];

function DestinationIcon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
    >
      {name === "overview" && (
        <>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v11h14V9M9 20v-6h6v6" />
        </>
      )}
      {name === "home" && (
        <>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v11h14V9M9 20v-6h6v6" />
        </>
      )}
      {name === "rooms" && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18M9 10v10" />
        </>
      )}
      {name === "renters" && (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1" />
        </>
      )}
      {name === "billing" && (
        <>
          <path d="M5 3h14v18l-3-2-4 2-4-2-3 2z" />
          <path d="M8 8h8M8 12h8M8 16h4" />
        </>
      )}
      {name === "contracts" && (
        <>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M15 3v5h5M9 13h7M9 17h7" />
        </>
      )}
      {name === "managers" && (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20v-1a6 6 0 0 1 12 0v1M17 8h4m-2-2v4" />
        </>
      )}
      {name === "more" && (
        <>
          <circle cx="5" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

function MoreMenu({ isSuperadmin }: { isSuperadmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const active =
    pathname === "/contracts" ||
    pathname?.startsWith("/contracts/") ||
    (isSuperadmin && pathname?.startsWith("/admin/managers"));
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !panel.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    window.addEventListener("pointerdown", outside);
    return () => window.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div className="relative min-w-0">
      <button
        ref={trigger}
        type="button"
        aria-label="Thêm điều hướng"
        aria-expanded={open}
        aria-controls="manager-more-menu"
        aria-current={active ? "page" : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            trigger.current?.focus();
          }
        }}
        className={`flex min-h-11 w-full min-w-0 flex-col items-center justify-center gap-0 rounded-input px-1 py-2 text-[0.7rem] font-semibold leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? "bg-primary text-surface" : "text-text-body hover:bg-canvas"}`}
      >
        <DestinationIcon name="more" />
        <span>Thêm</span>
      </button>
      {open && (
        <div
          ref={panel}
          id="manager-more-menu"
          aria-label="Điều hướng khác"
          className="absolute bottom-full right-0 z-30 mb-2 w-56 rounded-card border border-border bg-surface p-2 shadow-lg"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              trigger.current?.focus();
            }
          }}
        >
          <NavigationLink
            href="/contracts"
            compact
            label="Hợp đồng"
            onNavigate={() => setOpen(false)}
          >
            <DestinationIcon name="contracts" />
            <span>Hợp đồng</span>
          </NavigationLink>
          {isSuperadmin && (
            <NavigationLink
              href="/admin/managers"
              compact
              label="Quản lý tài khoản"
              onNavigate={() => setOpen(false)}
            >
              <DestinationIcon name="managers" />
              <span>Quản lý tài khoản</span>
            </NavigationLink>
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ role }: { role: "manager" | "superadmin" }) {
  const isSuperadmin = role === "superadmin";
  return (
    <>
      <aside
        aria-label="Thanh điều hướng"
        className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-[#263E4B] bg-[#172B3A] px-4 py-6 text-white lg:block"
      >
        <div className="mb-8 flex items-center gap-3 px-2">
          <Image
            src="/brand/logo-mark.svg"
            alt="Nhà Số Gọn"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0"
          />
          <span className="truncate font-heading text-lg font-bold tracking-tight text-white">
            Nhà Số Gọn
          </span>
        </div>
        <nav aria-label="Điều hướng chính" className="space-y-1">
          {destinations.map(({ href, label, icon }) => (
            <NavigationLink key={href} href={href}>
              <DestinationIcon name={icon} />
              {label}
            </NavigationLink>
          ))}
          {isSuperadmin && (
            <NavigationLink href="/admin/managers">
              <DestinationIcon name="managers" />
              Quản lý tài khoản
            </NavigationLink>
          )}
        </nav>
      </aside>
      <BottomNav>
        <div className="grid grid-cols-6 gap-1">
          {destinations.slice(0, 5).map(({ href, label, icon }) => (
            <NavigationLink key={href} href={href} compact label={label}>
              <DestinationIcon name={icon} />
              <span>{label === "Tính tiền & Hóa đơn" ? "Hóa đơn" : label}</span>
            </NavigationLink>
          ))}
          <MoreMenu isSuperadmin={isSuperadmin} />
        </div>
      </BottomNav>
    </>
  );
}
