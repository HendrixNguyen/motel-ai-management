import Link from "next/link";
import type { BillingPeriodDetailResponse } from "@/lib/api/types";

function readingState(readings: BillingPeriodDetailResponse["rooms"][number]["readings"]) {
  if (readings.some((reading) => reading.currentReading !== null)) return "Đang nhập";
  return "Chưa bắt đầu";
}

export default function CapturePeriodOverview({
  period,
  motelId,
}: {
  period: BillingPeriodDetailResponse;
  motelId: string;
}) {
  const total = period.rooms.length;
  const isRoomComplete = (readings: BillingPeriodDetailResponse["rooms"][number]["readings"]) => {
    const electricity = readings.filter((reading) => reading.type === "electric");
    const water = readings.filter((reading) => reading.type === "water");
    if (readings.length !== 2 || electricity.length !== 1 || water.length !== 1) return false;
    const electric = electricity[0];
    const waterReading = water[0];
    return (
      !!electric &&
      !!waterReading &&
      electric.currentReading !== null &&
      waterReading.currentReading !== null
    );
  };
  const done = period.rooms.filter((room) => isRoomComplete(room.readings)).length;
  const locked = period.status !== "draft";

  return (
    <section className="space-y-5" aria-label="Tổng quan kỳ nhập chỉ số">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
        <span className="font-semibold text-text">
          {locked ? "Kỳ đã chốt · Chỉ xem" : "Kỳ nháp · Có thể nhập"}
        </span>
        <span className="rounded-full bg-canvas px-3 py-1 text-sm font-semibold text-text-muted">
          Trạng thái đồng bộ sẽ hiển thị trong trang nhập.
        </span>
      </div>

      <section className="rounded-card border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold text-text">Tiến độ ghi chỉ số</h2>
            <p className="mt-1 text-sm text-text-muted">
              {done}/{total} phòng đã nhập đủ điện và nước
            </p>
          </div>
          <strong className="text-2xl tabular-nums text-primary">
            {done}/{total}
          </strong>
        </div>
        <div
          role="progressbar"
          aria-label="Tiến độ nhập chỉ số"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          className="mt-4 h-2 overflow-hidden rounded-full bg-border"
        >
          <span
            className="block h-full bg-primary"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
      </section>

      <ol className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
        {period.rooms.map((room) => {
          const reading = room.readings[0];
          const entered = room.readings.filter((item) => item.currentReading !== null).length;
          const state = readingState(room.readings);
          const content = (
            <>
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <strong className="truncate text-base font-semibold text-text">
                    Phòng {room.name}
                  </strong>
                  <span
                    className={`rounded-full px-2.5 py-1 text-sm font-semibold ${state === "Đang nhập" ? "bg-primary/10 text-primary" : "bg-canvas text-text-muted"}`}
                  >
                    {state}
                  </span>
                </span>
                <span className="grid grid-cols-1 gap-x-5 gap-y-1 text-sm text-text-muted sm:grid-cols-2">
                  {room.readings.map((item) => (
                    <span key={item.id} className="min-w-0">
                      <span className="font-medium text-text">
                        {item.type === "electric" ? "Điện" : "Nước"}
                      </span>
                      : {item.currentReading ?? "Chưa nhập"}{" "}
                      <span className="whitespace-nowrap">· trước {item.previousReading}</span>
                    </span>
                  ))}
                </span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-text-muted">
                {entered}/{room.readings.length}
              </span>
            </>
          );
          return (
            <li key={room.id}>
              {reading && !locked ? (
                <Link
                  href={`/capture/${period.id}/room/${reading.id}?motel=${encodeURIComponent(motelId)}&room=${encodeURIComponent(room.id)}`}
                  aria-label={`Phòng ${room.name}, ${state}, ${entered}/${room.readings.length} công tơ đã nhập`}
                  className="flex min-h-[72px] items-center gap-3 px-4 py-3 outline-offset-[-2px] hover:bg-canvas focus-visible:outline-2 focus-visible:outline-primary sm:px-5"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex min-h-[72px] items-center gap-3 px-4 py-3 sm:px-5">
                  {room.readings.length ? (
                    content
                  ) : (
                    <span role="status" className="text-warning">
                      Phòng {room.name}: chưa có công tơ để nhập.
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {locked ? (
        <p
          role="status"
          className="rounded-card border border-warning bg-warning-bg p-4 text-warning"
        >
          Hàng đợi được khóa, không thử gửi lại.
        </p>
      ) : total === 0 ? (
        <p
          role="status"
          className="rounded-card border border-border bg-canvas p-4 text-text-muted"
        >
          Chưa có phòng trong kỳ này; thêm phòng trước khi hoàn tất.
        </p>
      ) : (
        <Link
          href={`/billing/${period.id}?motel=${encodeURIComponent(motelId)}`}
          aria-disabled={done !== total}
          tabIndex={done !== total ? -1 : undefined}
          className={`flex min-h-[52px] w-full items-center justify-center rounded-input px-4 text-center font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${done === total ? "bg-primary text-surface" : "pointer-events-none bg-border text-text-muted"}`}
        >
          Hoàn tất &amp; tạo hóa đơn
        </Link>
      )}
    </section>
  );
}
