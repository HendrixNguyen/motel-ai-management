import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { listMotels } from "@/lib/api/motels";
import { listRooms } from "@/lib/api/rooms";
import { getRenter } from "@/lib/api/renters";
import { ApiError } from "@/lib/api/client";
import type { RecentInvoice } from "@/lib/api/types";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import { formatPhone } from "@/lib/format/phone";
import { formatCalendarDate, formatDate } from "@/lib/format/date";
import { formatVnd } from "@/lib/format/vnd";
import { oaFollowerLabel, renterStatusLabel } from "@/lib/format/status";
import Badge, { type BadgeTone } from "@/components/ui/badge";
import CopyButton from "@/components/ui/copy-button";
import RenterMagicLink from "@/components/manager/renter-magic-link";

const payment: Record<RecentInvoice["paymentStatus"], { label: string; tone: BadgeTone }> = {
  paid: { label: "Đã thanh toán", tone: "success" },
  unpaid: { label: "Chưa thanh toán", tone: "warning" },
  overdue: { label: "Quá hạn", tone: "danger" },
};

function isSafeImageUrl(url: string | null): url is string {
  if (!url || /[\\\s]/.test(url)) return false;
  if (url.startsWith("/")) return !url.startsWith("//");
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && !parsed.username && !parsed.password;
  } catch { return false; }
}

function IdentityImage({ url, side, name }: { url: string | null; side: "trước" | "sau"; name: string }) {
  // Private documents load directly in the browser without a referrer or server optimizer fetch.
  const safe = isSafeImageUrl(url);
  return <div className="min-w-0">
    {safe ? <><p className="mb-2 text-sm font-semibold text-text">CCCD mặt {side}</p>
      <div className="relative aspect-[8/5] w-full rounded-input border border-border bg-canvas">
        <Image src={url} alt={`CCCD mặt ${side} của ${name}`} fill sizes="(max-width: 640px) 100vw, 50vw" unoptimized loading="lazy" referrerPolicy="no-referrer" className="rounded-input object-contain" />
      </div></> : <p className="rounded-input border border-border bg-canvas p-4 text-base text-text-muted">CCCD mặt {side}: Chưa cập nhật</p>}
  </div>;
}

export default async function RenterDetail({ params, searchParams }: { params: Promise<{ renterId: string }>; searchParams: Promise<MotelSearchParams> }) {
  const motels = await listMotels();
  const query = await searchParams;
  const motelId = resolveMotelId(motels, query);
  if (!motelId) notFound();
  const { renterId } = await params;
  const renter = await getRenter(motelId, renterId).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
  const rooms = renter.roomId ? await listRooms(motelId) : [];
  const roomName = rooms.find((room) => room.id === renter.roomId)?.name;
  const backQuery = new URLSearchParams({ motel: motelId });
  if (typeof query.roomId === "string" && query.roomId) backQuery.set("roomId", query.roomId);
  const contract = renter.activeContract;

  return <section className="min-w-0 space-y-6">
    <Link href={`/renters?${backQuery}`} className="inline-flex min-h-11 items-center rounded-input px-2 font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Trở về khách thuê</Link>
    <div className="min-w-0"><h1 className="font-heading text-2xl font-bold text-text [overflow-wrap:anywhere]">{renter.name}</h1>
      <div className="mt-3 flex flex-wrap gap-2"><Badge tone={renter.status === "active" ? "success" : "neutral"} label={renterStatusLabel(renter.status)} /><Badge tone={renter.isOaFollower ? "success" : "warning"} label={oaFollowerLabel(renter.isOaFollower)} /></div></div>
    <section aria-labelledby="personal" className="min-w-0 rounded-card border border-border bg-surface p-4 sm:p-6">
      <h2 id="personal" className="font-heading text-lg font-semibold text-text">Thông tin cá nhân</h2>
      <dl className="mt-4 grid min-w-0 gap-4 text-base sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-sm text-text-muted">SĐT</dt><dd className="mt-1 space-y-2"><a href={`tel:+${renter.phone}`} className="inline-flex min-h-11 items-center rounded-input text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{formatPhone(renter.phone)}</a><CopyButton value={`+${renter.phone}`} label="Sao chép SĐT" /></dd></div>
        <div><dt className="text-sm text-text-muted">Số CCCD</dt><dd className="mt-1 text-text [overflow-wrap:anywhere]">{renter.idNumber ?? "Chưa cập nhật"}</dd></div>
        <div><dt className="text-sm text-text-muted">Phòng</dt><dd className="mt-1 text-text [overflow-wrap:anywhere]">{renter.roomId ? roomName ?? "Chưa cập nhật" : "Chưa xếp phòng"}</dd></div>
      </dl>
      <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2"><IdentityImage url={renter.idCardFrontUrl} side="trước" name={renter.name} /><IdentityImage url={renter.idCardBackUrl} side="sau" name={renter.name} /></div>
    </section>
    <section aria-labelledby="contract" className="min-w-0 rounded-card border border-border bg-surface p-4 sm:p-6">
      <h2 id="contract" className="font-heading text-lg font-semibold text-text">Hợp đồng đang hiệu lực</h2>
      {contract ? <dl className="mt-4 grid min-w-0 gap-4 text-base sm:grid-cols-2">
        <div><dt className="text-sm text-text-muted">Phòng theo hợp đồng</dt><dd className="mt-1 text-text [overflow-wrap:anywhere]">{contract.roomName}</dd></div>
        <div><dt className="text-sm text-text-muted">Tiền thuê / tháng</dt><dd className="mt-1 text-text tabular-nums [overflow-wrap:anywhere]">{formatVnd(contract.monthlyRent)}</dd></div>
        <div><dt className="text-sm text-text-muted">Ngày bắt đầu</dt><dd className="mt-1 text-text">{formatCalendarDate(contract.startDate)}</dd></div>
        <div><dt className="text-sm text-text-muted">Ngày kết thúc</dt><dd className="mt-1 text-text">{formatCalendarDate(contract.endDate)}</dd></div>
      </dl> : <div className="mt-4"><h3 className="font-semibold text-text">Chưa có hợp đồng đang hiệu lực</h3><p className="mt-2 text-base text-text-muted">Khách thuê chưa có thông tin hợp đồng đang hiệu lực.</p></div>}
    </section>
    <section aria-labelledby="invoices" className="min-w-0 rounded-card border border-border bg-surface p-4 sm:p-6">
      <h2 id="invoices" className="font-heading text-lg font-semibold text-text">Lịch sử hóa đơn</h2>
      {renter.invoices.length ? <ul className="mt-4 space-y-4">{renter.invoices.map((invoice) => <li key={invoice.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0"><p className="text-base text-text-muted">Ngày tạo: {formatDate(invoice.createdAt)}</p><p className="mt-1 text-base font-semibold text-text tabular-nums [overflow-wrap:anywhere]">{formatVnd(invoice.totalAmount)}</p></div>
        <Badge {...payment[invoice.paymentStatus]} />
      </li>)}</ul> : <div className="mt-4"><h3 className="font-semibold text-text">Chưa có hóa đơn</h3><p className="mt-2 text-base text-text-muted">Lịch sử hóa đơn sẽ xuất hiện khi có hóa đơn cho khách thuê này.</p></div>}
    </section>
    <section aria-labelledby="portal" className="min-w-0 rounded-card border border-border bg-surface p-4 sm:p-6"><h2 id="portal" className="font-heading text-lg font-semibold text-text">Liên kết dành cho khách thuê</h2><p className="mb-4 mt-2 max-w-prose text-base text-text-muted">Tạo liên kết để khách thuê truy cập trang của mình.</p><RenterMagicLink key={`${motelId}:${renterId}`} motelId={motelId} renterId={renterId} /></section>
  </section>;
}
