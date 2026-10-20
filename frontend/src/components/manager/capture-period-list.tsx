import Link from "next/link";
import { formatMonth } from "@/lib/format/date";
import type { BillingPeriodResponse } from "@/lib/api/types";

export default function CapturePeriodList({ periods, motelId }: { periods: BillingPeriodResponse[]; motelId: string }) {
  const drafts = periods.filter((period) => period.status === "draft");

  if (!drafts.length) return <p className="rounded-card border border-border bg-surface p-5 text-text-muted">Không có kỳ nháp.</p>;

  return <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
    {drafts.map((period) => <li key={period.id}>
      <Link href={`/capture/${period.id}?motel=${encodeURIComponent(motelId)}`} aria-label={`Mở kỳ ${formatMonth(period.year, period.month)}`} className="flex min-h-[72px] items-center justify-between gap-4 px-4 py-3 text-text outline-offset-[-2px] hover:bg-canvas focus-visible:outline-2 focus-visible:outline-primary sm:px-5">
        <span className="min-w-0"><strong className="block font-heading text-lg">Tháng {formatMonth(period.year, period.month)}</strong><span className="mt-1 block text-sm text-text-muted">Tiến độ phòng chưa có trong dữ liệu danh sách kỳ.</span></span>
        <span className="shrink-0 rounded-full bg-warning-bg px-3 py-1 text-sm font-semibold text-warning">Kỳ nháp</span>
      </Link>
    </li>)}
  </ul>;
}
