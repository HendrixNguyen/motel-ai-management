import type { ReactNode } from "react";

export default function ActionBar({ children, label = "Hành động" }: { children: ReactNode; label?: string }) {
  return <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>{children}</div>;
}
