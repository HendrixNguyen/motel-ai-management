import type { ReactNode } from "react";

export default function BottomNav({ children }: { children: ReactNode }) {
  return <nav aria-label="Điều hướng chính trên điện thoại" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden">{children}</nav>;
}
