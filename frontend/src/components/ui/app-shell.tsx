import type { ReactNode } from "react";

export default function AppShell({ sidebar, bottomNav, children }: { sidebar?: ReactNode; bottomNav?: ReactNode; children: ReactNode }) {
  return <div className="flex min-h-dvh">{sidebar}<div className="min-w-0 flex-1 shell-safe-area">{children}</div>{bottomNav}</div>;
}
