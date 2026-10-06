import type { ReactNode } from "react";

export default function StatCard({ label, value, description }: { label: string; value: string | number; description?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-surface p-4">
      <dl><dt className="text-sm text-text-muted">{label}</dt><dd className="mt-2 font-heading text-2xl font-bold text-text tabular-nums break-words">{value}</dd></dl>
      {description && <div className="mt-2 text-sm leading-normal text-text-body">{description}</div>}
    </div>
  );
}
