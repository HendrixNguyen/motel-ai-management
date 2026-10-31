import Link from "next/link";
import Badge from "@/components/ui/badge";
import Card from "@/components/ui/card";
import LedgerRow from "@/components/ui/ledger-row";
import PageHeader from "@/components/ui/page-header";
import StatCard from "@/components/ui/stat-card";
import MotelEditor from "@/components/manager/motel-editor";
import { listBillingPeriods, listInvoices } from "@/lib/api/billing";
import { listMotels } from "@/lib/api/motels";
import { listRenters } from "@/lib/api/renters";
import { listRooms } from "@/lib/api/rooms";
import type {
  BillingPeriodResponse,
  InvoiceResponse,
  MotelResponse,
  RenterResponse,
  RoomResponse,
  RoomStatus,
} from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { formatVnd } from "@/lib/format/vnd";
import { motelHref } from "@/lib/motel-navigation";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";

function Metric({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  href?: string;
}) {
  const content = <StatCard label={label} value={value} description={detail} />;
  return href ? (
    <Link
      className="block min-w-0 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      href={href}
    >
      {content}
    </Link>
  ) : (
    content
  );
}

function ReadFailure({ resource }: { resource: string }) {
  return (
    <div role="alert" className="min-w-0 rounded-card border border-danger bg-danger-bg p-5">
      <h2 className="font-heading text-lg font-semibold text-danger">Không thể tải {resource}</h2>
      <p className="mt-2 text-text-body">Dữ liệu chưa sẵn sàng. Tải lại trang để thử lại.</p>
      <Link
        href="/"
        className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline"
      >
        Tải lại trang
      </Link>
    </div>
  );
}

function isAuthRedirect(error: unknown): boolean {
  return (
    (error instanceof ApiError && error.status === 401) ||
    (error instanceof Error &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT;"))
  );
}

function isReadFailure<T>(value: PromiseSettledResult<T>): value is PromiseRejectedResult {
  return value.status === "rejected";
}

function InvoiceLedger({
  invoices,
  motelId,
  periodId,
}: {
  invoices: InvoiceResponse[];
  motelId: string;
  periodId: string;
}) {
  const unpaidCount = invoices.filter((invoice) => invoice.paymentStatus === "unpaid").length;
  const overdueCount = invoices.filter((invoice) => invoice.paymentStatus === "overdue").length;
  return (
    <section aria-labelledby="dashboard-invoices" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="dashboard-invoices" className="font-heading text-lg font-semibold text-text">
            Hóa đơn kỳ đang xử lý
          </h2>
          <p className="text-sm text-text-muted">
            {unpaidCount + overdueCount} hóa đơn chưa thu · {unpaidCount} chưa thanh toán ·{" "}
            {overdueCount} quá hạn
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-primary underline"
          href={motelHref(`/billing/${periodId}/invoices`, "", motelId)}
        >
          Xem tất cả hóa đơn
        </Link>
      </div>
      <Card className="divide-y divide-border p-4">
        {invoices.length ? (
          invoices.map((invoice) => (
            <LedgerRow
              key={invoice.id}
              title={invoice.roomName}
              detail={
                <span className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      invoice.paymentStatus === "paid"
                        ? "success"
                        : invoice.paymentStatus === "overdue"
                          ? "danger"
                          : "warning"
                    }
                    label={
                      invoice.paymentStatus === "paid"
                        ? "Đã thanh toán"
                        : invoice.paymentStatus === "overdue"
                          ? "Quá hạn"
                          : "Chưa thanh toán"
                    }
                  />
                </span>
              }
              value={<span className="whitespace-nowrap">{formatVnd(invoice.totalAmount)}</span>}
            />
          ))
        ) : (
          <p className="py-3 text-text-muted">Kỳ này chưa có hóa đơn.</p>
        )}
      </Card>
    </section>
  );
}

export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<MotelSearchParams>;
}) {
  let motels: MotelResponse[];
  try {
    motels = await listMotels();
  } catch (error) {
    if (isAuthRedirect(error)) throw error;
    return (
      <section className="min-w-0 space-y-6">
        <PageHeader title="Tổng quan" description="Việc cần làm hôm nay cho nhà trọ." />
        <ReadFailure resource="danh sách nhà trọ" />
      </section>
    );
  }
  const params = await searchParams;
  if (typeof params.motel === "string" && params.motel !== "")
    resolveMotelId(motels, { motel: params.motel });
  const motelId = resolveMotelId(motels, params);
  if (!motelId) {
    if (!motels.length)
      return (
        <section className="min-w-0 space-y-6">
          <PageHeader title="Tổng quan" description="Việc cần làm hôm nay cho nhà trọ." />
          <MotelEditor empty />
        </section>
      );
    return (
      <section className="min-w-0 space-y-6">
        <PageHeader title="Tổng quan" description="Chọn nhà trọ để xem số liệu vận hành." />
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {motels.map((item) => (
            <Card key={item.id} className="flex min-w-0 flex-col p-4 sm:p-6">
              <h2 className="font-heading text-lg font-semibold text-text [overflow-wrap:anywhere]">{item.name}</h2>
              <p className="mt-1 text-sm text-text-muted [overflow-wrap:anywhere]">{item.address || "Chưa có địa chỉ"}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Link
                  href={motelHref("/rooms", "", item.id)}
                  className="inline-flex min-h-11 items-center rounded-input bg-primary px-4 font-semibold text-surface hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Xem phòng
                </Link>
                <Link
                  href={motelHref("/renters", "", item.id)}
                  className="inline-flex min-h-11 items-center rounded-input border border-border-strong bg-surface px-4 font-semibold text-text hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Khách thuê
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>
    );
  }
  const motel = motels.find((item) => item.id === motelId);
  if (!motel)
    return (
      <section className="min-w-0 space-y-6">
        <PageHeader title="Tổng quan" description="Không tìm thấy nhà trọ đã chọn." />
        <ReadFailure resource="nhà trọ đã chọn" />
      </section>
    );
  const results = await Promise.allSettled([
    listRooms(motelId),
    listRenters(motelId),
    listBillingPeriods(motelId),
  ] as const);
  const [roomsResult, rentersResult, periodsResult] = results;
  if (isReadFailure(roomsResult) || isReadFailure(rentersResult) || isReadFailure(periodsResult)) {
    throw new Error(
      isReadFailure(roomsResult)
        ? "Không thể tải phòng"
        : isReadFailure(rentersResult)
          ? "Không thể tải khách thuê"
          : "Không thể tải kỳ hóa đơn",
    );
  }
  const rooms: RoomResponse[] = roomsResult.value;
  const renters: RenterResponse[] = rentersResult.value;
  const periods: BillingPeriodResponse[] = periodsResult.value;
  const counts: Record<RoomStatus, number> = { occupied: 0, available: 0, maintenance: 0 };
  for (const room of rooms) counts[room.status] += 1;
  const latest = periods[0];
  const currentPeriod =
    latest?.status === "draft" || latest?.status === "sent" ? latest : undefined;
  const createInvoicePeriod = latest?.status === "draft" ? latest : undefined;
  const invoices: InvoiceResponse[] = currentPeriod
    ? await listInvoices(motelId, currentPeriod.id)
    : [];
  const activeRenters = renters.filter((renter) => renter.status === "active");
  const occupancy = rooms.length ? Math.round((counts.occupied / rooms.length) * 100) : 0;
  const currentPeriodLabel = currentPeriod
    ? `Tháng ${String(currentPeriod.month).padStart(2, "0")}/${currentPeriod.year}`
    : "Chưa có kỳ hóa đơn";
  return (
    <section className="min-w-0 space-y-6">
      <PageHeader
        title="Tổng quan"
        description={`Tình hình tại ${motel.name} · ${currentPeriodLabel}.`}
        actions={
          <Link
            href={motelHref("/renters", "create=1", motelId)}
            className="inline-flex min-h-11 items-center rounded-input bg-primary px-4 py-2 font-semibold text-surface hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Thêm khách thuê
          </Link>
        }
      />
      <section aria-labelledby="dashboard-metrics" className="space-y-3">
        <h2 id="dashboard-metrics" className="font-heading text-lg font-semibold text-text">
          Tình hình phòng
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric
            label="Phòng đang thuê"
            value={`${counts.occupied}/${rooms.length}`}
            detail={`${counts.available} phòng trống · ${counts.maintenance} bảo trì · Tỷ lệ lấp đầy ${occupancy}%`}
            href={motelHref("/rooms", "", motelId)}
          />
          <Metric
            label="Phòng trống"
            value={String(counts.available)}
            detail={`Phòng đang thuê ${counts.occupied} · ${counts.maintenance} bảo trì`}
            href={motelHref("/rooms", "status=available", motelId)}
          />
          <Metric
            label="Khách đang ở"
            value={String(activeRenters.length)}
            detail="Khách thuê hoạt động"
            href={motelHref("/renters", "status=active", motelId)}
          />
        </div>
      </section>
      <section aria-labelledby="dashboard-actions" className="space-y-3">
        <h2 id="dashboard-actions" className="font-heading text-lg font-semibold text-text">
          Thao tác nhanh
        </h2>
        <Card className="divide-y divide-border p-0">
          <Link
            href={motelHref("/capture", "", motelId)}
            className="flex min-h-14 min-w-0 items-center justify-between gap-4 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span>
              <strong className="block text-text">Nhập chỉ số điện nước</strong>
              <span className="text-sm text-text-muted">Mở danh sách kỳ ghi chỉ số</span>
            </span>
            <span aria-hidden="true" className="text-primary">
              →
            </span>
          </Link>
          <Link
            href={
              createInvoicePeriod
                ? motelHref(`/billing/${createInvoicePeriod.id}`, "", motelId)
                : motelHref("/billing", "", motelId)
            }
            className="flex min-h-14 min-w-0 items-center justify-between gap-4 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span>
              <strong className="block text-text">Tạo hóa đơn</strong>
              <span className="text-sm text-text-muted">
                {createInvoicePeriod
                  ? `Tháng ${String(createInvoicePeriod.month).padStart(2, "0")}/${createInvoicePeriod.year}`
                  : "Tạo kỳ hóa đơn mới"}
              </span>
            </span>
            <span aria-hidden="true" className="text-primary">
              →
            </span>
          </Link>
          <Link
            href={motelHref("/renters", "create=1", motelId)}
            className="flex min-h-14 min-w-0 items-center justify-between gap-4 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span>
              <strong className="block text-text">Thêm khách thuê</strong>
              <span className="text-sm text-text-muted">Tạo hồ sơ khách thuê mới</span>
            </span>
            <span aria-hidden="true" className="text-primary">
              →
            </span>
          </Link>
        </Card>
      </section>
      {currentPeriod && (
        <InvoiceLedger invoices={invoices} motelId={motelId} periodId={currentPeriod.id} />
      )}
      {rooms.length === 0 && (
        <Card>
          <h2 className="font-heading text-lg font-semibold text-text">Chưa có phòng trọ</h2>
          <p className="mt-1 text-text-muted">Thêm phòng để bắt đầu theo dõi tình hình nhà trọ.</p>
          <Link
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline"
            href={motelHref("/rooms", "", motelId)}
          >
            Xem phòng trọ
          </Link>
        </Card>
      )}
    </section>
  );
}
