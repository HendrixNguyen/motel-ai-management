import type { ReactNode } from "react";

export default function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="flex items-center justify-between gap-4"><h2 className="font-heading text-xl font-semibold text-text">{title}</h2>{action}</div>;
}
