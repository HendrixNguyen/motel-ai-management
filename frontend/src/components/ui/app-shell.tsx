import type { ReactNode } from "react";

export default function AppShell({ sidebar, bottomNav, children }: { sidebar?: ReactNode; bottomNav?: ReactNode; children: ReactNode }) {
  return <div className="min-h-dvh">{sidebar}<div className="min-w-0 shell-safe-area">{children}</div>{bottomNav}</div>;
}
