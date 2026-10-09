import type { ReactNode } from "react";

export default function Card({ children, className = "", as: Element = "section", ...props }: { children: ReactNode; className?: string; as?: "section" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return <Element className={`min-w-0 rounded-card border border-border bg-surface p-4 ${className}`} {...props}>{children}</Element>;
}
