import Link from "next/link";
import { notFound } from "next/navigation";
import { listMotels } from "@/lib/api/motels";
import { listRenters } from "@/lib/api/renters";
import { listBillingPeriods, listInvoices } from "@/lib/api/billing";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import InvoiceActions from "@/components/manager/invoice-actions";
import FinalizePeriod from "@/components/manager/finalize-period";
import Badge from "@/components/ui/badge";
import Card from "@/components/ui/card";
import { formatVnd } from "@/lib/format/vnd";
import PageHeader from "@/components/ui/page-header";

const labels = { unpaid: "Chưa thanh toán", paid: "Đã thanh toán", overdue: "Quá hạn" } as const;

export default async function InvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ periodId: string }>;
  searchParams: Promise<MotelSearchParams>;
}) {
  const [route, query, motels] = await Promise.all([params, searchParams, listMotels()]);
  const motelId = resolveMotelId(motels, query);
  if (!motelId) return <p>Chưa có nhà trọ.</p>;
  const motel = motels.find((item) => item.id === motelId);
  const [periods, renters, invoices] = await Promise.all([
    listBillingPeriods(motelId),
    listRenters(motelId),
    listInvoices(motelId, route.periodId),
  ]);
  const period = periods.find((item) => item.id === route.periodId);
  if (!period) notFound();
  const renterNames = new Map(renters.map((renter) => [renter.id, renter.name]));
  const renterPhones = new Map(renters.map((renter) => [renter.id, renter.phone]));
  const paidTotal = invoices
    .filter((invoice) => invoice.paymentStatus === "paid")
    .reduce((total, invoice) => total + BigInt(invoice.totalAmount), 0n)
    .toString();
  const outstandingTotal = invoices
    .filter((invoice) => invoice.paymentStatus !== "paid")
    .reduce((total, invoice) => total + BigInt(invoice.totalAmount), 0n)
    .toString();

  return (
    <section className="space-y-6">
      <PageHeader
        title={`Hóa đơn tháng ${String(period.month).padStart(2, "0")}/${period.year}`}
        description="Kiểm tra từng khoản trước khi chốt kỳ."
        actions={
          <Link
            href={`/billing/${period.id}?motel=${encodeURIComponent(motelId)}`}
            className="inline-flex min-h-11 items-center rounded-input border border-border-strong px-4 font-semibold text-text"
          >
            Xem chỉ số
          </Link>
        }
      />
      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-4 sm:px-5">
          <div>
            <p className="text-sm text-text-muted">Tổng số hóa đơn</p>
            <p className="font-heading text-2xl font-bold tabular-nums text-text">
              {invoices.length}
            </p>
          </div>
          <FinalizePeriod
            motelId={motelId}
            periodId={period.id}
            disabled={period.status !== "draft" || invoices.length === 0}
          />
        </div>
        <dl className="grid gap-4 p-4 sm:grid-cols-2 sm:px-5">
          <div>
            <dt className="text-sm text-text-muted">Đã thu</dt>
            <dd className="whitespace-nowrap font-heading text-lg font-bold tabular-nums text-success">
              {formatVnd(paidTotal)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">Chưa thu</dt>
            <dd className="whitespace-nowrap font-heading text-lg font-bold tabular-nums text-text">
              {formatVnd(outstandingTotal)}
            </dd>
          </div>
        </dl>
      </Card>
      {invoices.length === 0 ? (
        <Card className="border-dashed p-6 text-text-muted">
          <p>Chưa có hóa đơn.</p>
          <p className="mt-1 text-sm">
            Tạo hóa đơn sau khi hoàn tất chỉ số và kiểm tra phòng đủ điều kiện.
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-5 border-b border-border bg-canvas px-5 py-3 text-sm font-semibold text-text-muted sm:grid">
            <span>Phòng và khách thuê</span>
            <span>Trạng thái</span>
            <span className="text-right">Tổng tiền</span>
          </div>
          {invoices.map((invoice) => (
            <article
              key={invoice.id}
              className="min-w-0 border-b border-border p-4 last:border-b-0 sm:p-5"
            >
              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-start sm:gap-5">
                <div className="min-w-0">
                  <p className="text-sm text-text-muted">Phòng {invoice.roomName}</p>
                  <h2 className="mt-1 break-words font-heading text-lg font-semibold text-text">
                    {renterNames.get(invoice.renterId) ?? "Không rõ khách thuê"}
                  </h2>
                </div>
                <Badge
                  tone={
                    invoice.paymentStatus === "paid"
                      ? "success"
                      : invoice.paymentStatus === "overdue"
                        ? "danger"
                        : "warning"
                  }
                  label={labels[invoice.paymentStatus]}
                />
                <p className="whitespace-nowrap font-heading text-lg font-bold tabular-nums text-text sm:text-right">
                  {formatVnd(invoice.totalAmount)}
                </p>
              </div>
              {invoice.paymentStatus === "paid" && invoice.paymentMethod && (
                <p className="mt-2 text-sm text-text-muted">
                  {invoice.paymentMethod === "cash"
                    ? "Đã thanh toán bằng tiền mặt"
                    : "Đã thanh toán qua chuyển khoản"}
                </p>
              )}
              <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-border pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Tiền thuê</dt>
                  <dd className="whitespace-nowrap font-medium tabular-nums">
                    {formatVnd(invoice.rentAmount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Điện ({invoice.electricityUsage})</dt>
                  <dd className="whitespace-nowrap font-medium tabular-nums">
                    {formatVnd(invoice.electricityCost)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Nước ({invoice.waterUsage})</dt>
                  <dd className="whitespace-nowrap font-medium tabular-nums">
                    {formatVnd(invoice.waterCost)}
                  </dd>
                </div>
                {invoice.otherFees.map((fee) => (
                  <div key={fee.name} className="flex justify-between gap-3">
                    <dt className="min-w-0 break-words text-text-muted">{fee.name}</dt>
                    <dd className="whitespace-nowrap font-medium tabular-nums">
                      {formatVnd(fee.amount)}
                    </dd>
                  </div>
                ))}
              </dl>
              <InvoiceActions
                motelId={motelId}
                invoice={invoice}
                bankAccount={motel?.bankAccount ?? null}
                renterPhone={renterPhones.get(invoice.renterId)}
                billingPeriod={{ month: period.month, year: period.year }}
                allowAssistedSend={period.status !== "draft"}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
