import { notFound } from "next/navigation";
import { listMotels } from "@/lib/api/motels";
import { listBillingPeriods, listInvoices } from "@/lib/api/billing";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import InvoiceActions from "@/components/manager/invoice-actions";
import Badge from "@/components/ui/badge";
import { formatVnd } from "@/lib/format/vnd";

const labels = { unpaid: "Chưa thanh toán", paid: "Đã thanh toán", overdue: "Quá hạn" } as const;
export default async function InvoicesPage({ params, searchParams }: { params: Promise<{ periodId: string }>; searchParams: Promise<MotelSearchParams> }) {
  const [route, query, motels] = await Promise.all([params, searchParams, listMotels()]); const motelId = resolveMotelId(motels, query); if (!motelId) return <p>Chưa có nhà trọ.</p>;
  const periods = await listBillingPeriods(motelId); const period = periods.find((item) => item.id === route.periodId); if (!period) notFound(); const invoices = await listInvoices(motelId, route.periodId);
  return <section className="space-y-6"><div><h1 className="font-heading text-2xl font-bold text-text">Hóa đơn tháng {String(period.month).padStart(2, "0")}/{period.year}</h1><p className="mt-2 text-text-muted">Số tiền lấy từ kết quả backend.</p></div>{invoices.length === 0 ? <p className="rounded-card border border-border bg-surface p-6 text-text-muted">Chưa có hóa đơn.</p> : <div className="grid gap-3">{invoices.map((invoice) => <article key={invoice.id} className="rounded-card border border-border bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-heading font-semibold text-text">Phòng {invoice.roomName}</h2><p className="text-sm text-text-muted">Tiền thuê {formatVnd(invoice.rentAmount)} · Điện {formatVnd(invoice.electricityCost)} · Nước {formatVnd(invoice.waterCost)}</p></div><Badge tone={invoice.paymentStatus === "paid" ? "success" : invoice.paymentStatus === "overdue" ? "warning" : "neutral"} label={labels[invoice.paymentStatus]} /></div><p className="mt-3 text-lg font-bold text-text">{formatVnd(invoice.totalAmount)}</p><InvoiceActions motelId={motelId} invoice={invoice} /></article>)}</div>}</section>;
}
