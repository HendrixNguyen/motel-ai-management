import { notFound } from "next/navigation";
import { listMotels } from "@/lib/api/motels";
import { listRenters } from "@/lib/api/renters";
import { listBillingPeriods, listInvoices } from "@/lib/api/billing";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import InvoiceActions from "@/components/manager/invoice-actions";
import FinalizePeriod from "@/components/manager/finalize-period";
import Badge from "@/components/ui/badge";
import { formatVnd } from "@/lib/format/vnd";
import PageHeader from "@/components/ui/page-header";

const labels = { unpaid: "Chưa thanh toán", paid: "Đã gửi", overdue: "Quá hạn" } as const;
export default async function InvoicesPage({ params, searchParams }: { params: Promise<{ periodId: string }>; searchParams: Promise<MotelSearchParams> }) {
  const [route, query, motels] = await Promise.all([params, searchParams, listMotels()]); const motelId = resolveMotelId(motels, query); if (!motelId) return <p>Chưa có nhà trọ.</p>; const motel = motels.find((item) => item.id === motelId);
  const [periods, renters, invoices] = await Promise.all([listBillingPeriods(motelId), listRenters(motelId), listInvoices(motelId, route.periodId)]); const period = periods.find((item) => item.id === route.periodId); if (!period) notFound(); const renterNames = new Map(renters.map((renter) => [renter.id, renter.name]));
  return <section className="space-y-6"><div><PageHeader title={`Hóa đơn tháng ${String(period.month).padStart(2, "0")}/${period.year}`} description="Số tiền lấy từ kết quả backend." /></div><FinalizePeriod motelId={motelId} periodId={period.id} disabled={period.status !== "draft" || invoices.length === 0} />{invoices.length === 0 ? <p className="rounded-card border border-border bg-surface p-6 text-text-muted">Chưa có hóa đơn.</p> : <div className="grid gap-3">{invoices.map((invoice) => <article key={invoice.id} className="rounded-card border border-border bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-heading font-semibold text-text">Phòng {invoice.roomName}</h2><p className="text-sm text-text-muted">Khách: {renterNames.get(invoice.renterId) ?? "Không rõ"}</p><p className="text-sm text-text-muted">Tiền thuê {formatVnd(invoice.rentAmount)} · Điện {formatVnd(invoice.electricityCost)} · Nước {formatVnd(invoice.waterCost)}</p><p className="text-sm text-text-muted">Phí khác: {invoice.otherFees.length ? invoice.otherFees.map((fee) => `${fee.name}: ${formatVnd(fee.amount)}`).join(", ") : "Không có"}</p>{invoice.paidAt && <p className="text-sm text-text-muted">Đã thanh toán: {new Date(invoice.paidAt).toLocaleString("vi-VN")}</p>}</div><Badge tone={invoice.paymentStatus === "paid" ? "success" : invoice.paymentStatus === "overdue" ? "danger" : "warning"} label={labels[invoice.paymentStatus]} /></div><p className="mt-3 text-lg font-bold text-text">{formatVnd(invoice.totalAmount)}</p><InvoiceActions motelId={motelId} invoice={invoice} bankAccount={motel?.bankAccount ?? null} /></article>)}</div>}</section>;
}
