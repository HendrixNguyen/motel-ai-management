import Link from "next/link";
import { serverGetRenter } from "@/lib/api/renter.server";
import type { RenterInvoiceSummary, RenterPeriod } from "@/lib/api/types";
import { formatVnd } from "@/lib/format/vnd";

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const periods = await serverGetRenter<RenterPeriod[]>("/api/renter/billing/periods");
  const invoices = period ? await serverGetRenter<RenterInvoiceSummary[]>(`/api/renter/billing/periods/${encodeURIComponent(period)}/invoices`) : [];
  return <section className="space-y-5">
    <Link href="/portal" className="text-sm font-semibold text-primary underline">← Trang chủ</Link>
    <div><h1 className="font-heading text-2xl font-bold text-text">Lịch sử hóa đơn</h1><p className="mt-1 text-text-muted">Chọn kỳ để xem chi tiết và mã QR thanh toán.</p></div>
    <nav aria-label="Kỳ hóa đơn" className="flex gap-2 overflow-x-auto pb-1">
      {periods.map((item) => <Link key={item.id} href={`/portal/bills?period=${encodeURIComponent(item.id)}`} aria-current={item.id === period ? "page" : undefined} className={`min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${item.id === period ? "border-primary bg-primary text-surface" : "border-border-strong text-text"}`}>Tháng {String(item.month).padStart(2, "0")}/{item.year}</Link>)}
    </nav>
    {invoices.length ? <div className="space-y-3">{invoices.map((invoice) => <Link key={invoice.id} href={`/portal/bills/${invoice.id}`} className="block rounded-card border border-border p-4 focus-visible:outline-2 focus-visible:outline-primary"><p className="font-semibold text-text">{invoice.roomName}</p><p className="mt-1 text-sm text-text-muted">{formatVnd(invoice.totalAmount)} · {invoice.paymentStatus === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}</p></Link>)}</div> : <p className="rounded-card border border-border p-5 text-text-muted">{period ? "Kỳ này chưa có hóa đơn." : periods.length ? "Chọn một kỳ hóa đơn." : "Chưa có hóa đơn."}</p>}
  </section>;
}
