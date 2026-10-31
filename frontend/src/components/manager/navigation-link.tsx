"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motelHref } from "@/lib/motel-navigation";

/** Only the URL-dependent anchor is client-rendered; Sidebar owns the destination list. */
export default function NavigationLink({
  href,
  children,
  compact = false,
  label,
  preserveCurrentSearch = true,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  compact?: boolean;
  label?: string;
  preserveCurrentSearch?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active =
    href === "/" ? pathname === "/" : pathname === href || pathname?.startsWith(`${href}/`);
  return (
    <Link
      href={motelHref(
        href,
        preserveCurrentSearch ? (searchParams?.toString() ?? "") : "",
        searchParams?.get("motel") ?? undefined,
      )}
      onClick={onNavigate}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-motion="navigation-link"
      className={`flex min-h-11 min-w-0 items-center gap-2 rounded-input px-2 py-2 font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${compact ? "flex-col justify-center gap-0 text-[0.7rem] leading-tight" : "px-4 text-base"} ${active ? "bg-primary text-surface" : compact ? "text-text-body hover:bg-canvas active:bg-border" : "text-white/85 hover:bg-white/10 active:bg-white/15"} motion-reduce:transition-none`}
    >
      {children}
    </Link>
  );
}
