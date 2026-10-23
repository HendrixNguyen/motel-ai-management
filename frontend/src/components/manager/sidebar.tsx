"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import NavigationLink from "./navigation-link";
import BottomNav from "@/components/ui/bottom-nav";

const destinations = [
  { href: "/", label: "Tổng quan", icon: "overview" },
  { href: "/motels", label: "Nhà trọ", icon: "home" },
  { href: "/rooms", label: "Phòng trọ", icon: "rooms" },
  { href: "/renters", label: "Khách thuê", icon: "renters" },
  { href: "/billing", label: "Tính tiền & Hóa đơn", icon: "billing" },
  { href: "/contracts", label: "Hợp đồng", icon: "contracts" },
] as const;

const primaryDestinations = destinations.slice(0, 5);
const secondaryDestinations = destinations.slice(5);

function DestinationIcon({ name }: { name: (typeof destinations)[number]["icon"] }) {
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
    </svg>
  );
}

export default function Sidebar() {
  return (
    <>
      <aside
        aria-label="Thanh điều hướng"
        className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-[#263E4B] bg-[#172B3A] px-4 py-6 text-white lg:block"
      >
        <div className="mb-8 px-4">
          <Image
            src="/brand/logo.svg"
            alt="Nhà Số Gọn"
            width={160}
            height={40}
            className="h-10 w-auto"
          />
        </div>
        <nav aria-label="Điều hướng chính" className="space-y-1">
          {destinations.map(({ href, label, icon }) => (
            <NavigationLink key={href} href={href}>
              <DestinationIcon name={icon} />
              {label}
            </NavigationLink>
          ))}
        </nav>
      </aside>
      <BottomNav>
        <div aria-label="Điều hướng gọn trên điện thoại" className="grid grid-cols-6 gap-1">
          {primaryDestinations.map(({ href, label, icon }) => (
            <NavigationLink key={href} href={href} compact label={label}>
              <DestinationIcon name={icon} />
              <span>{label === "Tính tiền & Hóa đơn" ? "Hóa đơn" : label}</span>
            </NavigationLink>
          ))}
          <MobileMoreMenu />
        </div>
      </BottomNav>
    </>
  );
}

function MobileMoreMenu() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const active = secondaryDestinations.some(({ href }) =>
    href === "/" ? pathname === "/" : pathname === href || pathname?.startsWith(`${href}/`),
  );
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);
  return (
    <div className="relative min-w-0">
      <button
        ref={trigger}
        type="button"
        aria-label="Thêm, các mục khác"
        aria-expanded={open}
        aria-controls="manager-more-routes"
        onClick={() => setOpen((value) => !value)}
        className={`flex min-h-11 min-w-0 w-full flex-col items-center justify-center gap-0 rounded-input px-1 py-2 text-[0.7rem] font-semibold leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? "bg-primary text-surface" : "text-text-body hover:bg-canvas active:bg-border"}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-5 w-5"
        >
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </svg>
        <span>Thêm</span>
      </button>
      <div
        id="manager-more-routes"
        role="group"
        aria-label="Các mục khác"
        hidden={!open}
        className="absolute bottom-full right-0 z-30 mb-2 w-56 max-w-[calc(100vw-1rem)] rounded-card border border-border bg-surface p-2 shadow-lg"
      >
        {secondaryDestinations.map(({ href: route, label, icon }) => (
          <NavigationLink
            key={route}
            href={route}
            preserveCurrentSearch={false}
            compact
            label={label}
            onNavigate={() => setOpen(false)}
          >
            <DestinationIcon name={icon} />
            <span>{label}</span>
          </NavigationLink>
        ))}
      </div>
    </div>
  );
}
