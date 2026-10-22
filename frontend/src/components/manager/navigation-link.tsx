"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motelHref } from "@/lib/motel-navigation";

/** Only the URL-dependent anchor is client-rendered; Sidebar owns the destination list. */
export default function NavigationLink({ href, children, compact = false, collapsed = false, label }: { href: string; children: React.ReactNode; compact?: boolean; collapsed?: boolean; label?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname?.startsWith(`${href}/`);
  return (
    <Link href={motelHref(href, "", searchParams?.get("motel") ?? undefined)} aria-label={label} title={label} aria-current={active ? "page" : undefined}
      data-motion="navigation-link" className={`flex min-h-11 min-w-0 items-center rounded-input font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${collapsed ? "justify-center p-2 text-base" : compact ? "flex-col justify-center gap-0 text-[0.7rem] leading-tight" : "gap-3 px-4 py-2 text-base"} ${active ? "bg-primary text-surface" : "text-text-body hover:bg-canvas active:bg-border"} motion-reduce:transition-none`}>
      {children}
    </Link>
  );
}
