import Link from "next/link";
import { listMotels } from "@/lib/api/motels";
import { listBillingPeriods } from "@/lib/api/billing";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import BillingPeriodEditor from "@/components/manager/billing-period-editor";
import PageHeader from "@/components/ui/page-header";
import Badge from "@/components/ui/badge";
import Card from "@/components/ui/card";

const labels = { draft: "Bản nháp", sent: "Đã gửi", closed: "Đã đóng" } as const;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<MotelSearchParams>;
}) {
  const motels = await listMotels();
  const params = await searchParams;
  const motelId = resolveMotelId(motels, params);
  if (!motelId)
    return (
      <section className="space-y-4">
        <PageHeader
          title="Tính tiền & Hóa đơn"
          description="Tạo kỳ, nhập số điện nước và chốt hóa đơn."
        />
        <p className="rounded-card border border-border bg-surface p-6 text-text-muted">
          Chưa có nhà trọ để tạo kỳ hóa đơn.
        </p>
      </section>
    );
  const periods = await listBillingPeriods(motelId);
  return (
    <section className="space-y-6">
      <PageHeader
        title="Tính tiền & Hóa đơn"
        description="Theo dõi kỳ tính tiền, nhập chỉ số và chốt hóa đơn."
        actions={<BillingPeriodEditor motelId={motelId} />}
      />
      {periods.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-text-muted">
          <p>Chưa có kỳ hóa đơn.</p>
          <p className="mt-1 text-sm">Tạo kỳ đầu tiên để bắt đầu nhập chỉ số.</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-6 border-b border-border bg-canvas px-5 py-3 text-sm font-semibold text-text-muted sm:grid">
            <span>Kỳ hóa đơn</span>
            <span>Trạng thái</span>
            <span className="text-right">Mở kỳ</span>
          </div>
          {periods.map((period) => (
            <Link
              key={period.id}
              href={`/billing/${period.id}?motel=${encodeURIComponent(motelId)}`}
              className="grid min-w-0 grid-cols-1 items-center gap-3 border-b border-border px-4 py-4 last:border-b-0 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-primary sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-6 sm:px-5"
            >
              <div className="min-w-0">
                <p className="text-sm text-text-muted">Kỳ tính tiền</p>
                <h2 className="mt-1 font-heading text-lg font-bold text-text">
                  Tháng {String(period.month).padStart(2, "0")}/{period.year}
                </h2>
              </div>
              <Badge
                tone={
                  period.status === "sent"
                    ? "success"
                    : period.status === "closed"
                      ? "warning"
                      : "neutral"
                }
                label={labels[period.status]}
              />
              <span className="text-sm font-semibold text-primary sm:text-right">Mở kỳ</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
