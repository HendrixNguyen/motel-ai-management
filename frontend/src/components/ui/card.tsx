import type { ReactNode } from "react";

export default function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-card border border-border bg-surface p-4 ${className}`}>{children}</section>;
}
