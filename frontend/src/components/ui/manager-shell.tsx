import type { ReactNode } from "react";
import AppShell from "./app-shell";

export default function ManagerShell({ sidebar, header, children, bottomNav }: { sidebar: ReactNode; header: ReactNode; children: ReactNode; bottomNav?: ReactNode }) {
  return <AppShell sidebar={sidebar} bottomNav={bottomNav}><div>{header}<main id="main-content" data-motion="page" tabIndex={-1} className="motion-safe:animate-[page-enter_160ms_ease-out_both] mx-auto w-full max-w-7xl px-4 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-8">{children}</main></div></AppShell>;
}
