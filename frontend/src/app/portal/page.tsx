import { serverGetRenter } from "@/lib/api/renter.server";
import type { RenterInvoiceSummary, RenterPeriod } from "@/lib/api/types";
import Link from "next/link";
import PushOptIn from "@/components/renter/push-opt-in";
import { formatVnd } from "@/lib/format/vnd";

export default async function RenterHomePage() {
  const [periods, unpaid] = await Promise.all([
    serverGetRenter<RenterPeriod[]>("/api/renter/billing/periods"),
    serverGetRenter<RenterInvoiceSummary[]>("/api/renter/billing/unpaid-invoices"),
  ]);
  return (
    <section className="space-y-6">
      <div className="rounded-card bg-primary p-5 text-surface">
        <p className="text-sm text-primary-fixed">CỔNG KHÁCH THUÊ</p>
        <h1 className="mt-2 font-heading text-2xl font-bold">Hóa đơn của tôi</h1>
        <p className="mt-2 text-base text-primary-fixed">
          Chọn kỳ để xem chi tiết tiền thuê và chỉ số.
        </p>
      </div>
      {unpaid.length > 0 && (
        <section aria-labelledby="unpaid-invoices-heading" className="space-y-3">
          <h2 id="unpaid-invoices-heading" className="font-heading text-lg font-semibold text-text">
            Hóa đơn cần thanh toán
          </h2>
          {unpaid.map((invoice) => (
            <article key={invoice.id} className="rounded-card border border-border bg-surface p-4">
              <p className="font-semibold text-text">
                Phòng {invoice.roomName} · Tháng {String(invoice.month).padStart(2, "0")}/
                {invoice.year}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                {formatVnd(invoice.totalAmount)} ·{" "}
                {invoice.paymentStatus === "overdue" ? "Quá hạn" : "Chưa thanh toán"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  className="min-h-11 rounded-input border border-border px-4 py-2 font-semibold text-primary"
                  href={`/portal/bills/${invoice.id}`}
                >
                  Xem QR
                </Link>
                <Link
                  className="min-h-11 rounded-input bg-primary px-4 py-2 font-semibold text-white"
                  href={`/portal/bills/${invoice.id}#payment-proof-title`}
                >
                  Gửi chứng từ
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
      {periods.length ? (
        <div className="space-y-3">
          {periods.map((period) => (
            <Link
              key={period.id}
              href={`/portal/bills?period=${period.id}`}
              className="block min-h-11 rounded-card border border-border p-4 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="font-semibold text-text">
                Tháng {String(period.month).padStart(2, "0")}/{period.year}
              </span>
              <span className="mt-1 block text-sm text-text-muted">
                {period.status === "draft"
                  ? "Đang lập"
                  : period.status === "sent"
                    ? "Đã gửi"
                    : "Đã đóng"}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-card border border-border p-5 text-text-muted">Chưa có hóa đơn.</p>
      )}
      <PushOptIn />
      <nav className="flex flex-wrap gap-3 border-t border-border pt-4">
        <Link
          className="min-h-11 rounded-input border border-border-strong px-4 py-2.5 font-semibold text-primary"
          href="/portal/bills"
        >
          Lịch sử hóa đơn
        </Link>
        <Link
          className="min-h-11 rounded-input border border-border-strong px-4 py-2.5 font-semibold text-primary"
          href="/portal/contract"
        >
          Hợp đồng
        </Link>
        <Link
          className="min-h-11 rounded-input border border-border-strong px-4 py-2.5 font-semibold text-primary"
          href="/portal/tickets"
        >
          Báo sự cố
        </Link>
      </nav>
    </section>
  );
}
