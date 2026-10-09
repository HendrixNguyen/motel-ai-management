import type { ReactNode } from "react";

export default function MobileDataRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid min-w-0 gap-1 border-b border-border px-4 py-3 sm:grid-cols-[minmax(10rem,0.7fr)_minmax(0,1.3fr)] sm:items-center sm:gap-4"><dt className="text-sm text-text-muted">{label}</dt><dd className="min-w-0 break-words text-text">{children}</dd></div>;
}
