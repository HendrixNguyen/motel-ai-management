import { listRenterInvoices } from "@/lib/api/renter";
import Link from "next/link";
import { formatVnd } from "@/lib/format/vnd";

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const invoices = period ? await listRenterInvoices(period) : [];
  return <section className="space-y-5"><Link href="/portal" className="text-sm font-semibold text-primary underline">← Trang chủ</Link><h1 className="font-heading text-2xl font-bold text-text">Lịch sử hóa đơn</h1>{invoices.length ? invoices.map((invoice) => <Link key={invoice.id} href={`/portal/bills/${invoice.id}`} className="block rounded-card border border-border p-4"><p className="font-semibold text-text">{invoice.roomName}</p><p className="mt-1 text-sm text-text-muted">{formatVnd(invoice.totalAmount)} · {invoice.paymentStatus === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}</p></Link>) : <p className="rounded-card border border-border p-5 text-text-muted">Chọn kỳ hóa đơn để xem lịch sử.</p>}</section>;
}
