import type { ReactNode } from "react";

export default function LedgerRow({
  title,
  value,
  detail,
}: {
  title: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 break-words">
        <div className="font-medium text-text">{title}</div>
        {detail && <div className="mt-1 break-words text-sm text-text-muted">{detail}</div>}
      </div>
      <div className="min-w-0 break-words text-left font-semibold text-text tabular-nums sm:shrink-0 sm:text-right">
        {value}
      </div>
    </div>
  );
}
