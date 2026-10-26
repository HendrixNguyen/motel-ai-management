"use client";

import Image from "next/image";
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
        </nav>
      </aside>
      <BottomNav>
        <nav aria-label="Điều hướng gọn trên điện thoại" className="grid grid-cols-6 gap-1">
          {destinations.map(({ href, label, icon }) => (
            <NavigationLink key={href} href={href} compact label={label}>
              <DestinationIcon name={icon} />
              <span>{label === "Tính tiền & Hóa đơn" ? "Hóa đơn" : label}</span>
            </NavigationLink>
          ))}
        </nav>
      </BottomNav>
    </>
  );
}
