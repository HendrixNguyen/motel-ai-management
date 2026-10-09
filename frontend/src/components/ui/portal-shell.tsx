import type { ReactNode } from "react";
import AppShell from "./app-shell";

export default function PortalShell({ header, children }: { header: ReactNode; children: ReactNode }) {
  return <AppShell><div className="mx-auto min-h-dvh w-full max-w-[480px] bg-surface px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">{header}<main>{children}</main></div></AppShell>;
}
