import type { ReactNode } from "react";

export default function ActionBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2" role="group">{children}</div>;
}
