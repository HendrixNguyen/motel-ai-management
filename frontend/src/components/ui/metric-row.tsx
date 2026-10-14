import type { ReactNode } from "react";

export default function MetricRow({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <div className="flex items-baseline justify-between gap-4 border-b border-border py-4 last:border-b-0"><span className="text-text-muted">{label}</span><span className="text-right font-semibold text-text">{value}{detail && <span className="ml-2 text-sm font-normal text-text-muted">{detail}</span>}</span></div>;
}
