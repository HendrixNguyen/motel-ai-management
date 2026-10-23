"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveCaptureReadings, uploadMeterPhoto, isReadingConflict } from "@/lib/api/capture.client";
import { CaptureQueue, CaptureQueueUnavailableError } from "@/lib/capture/queue";
import { createCaptureQueueScope } from "@/lib/capture/queue-scope";
import { syncCaptureQueue } from "@/lib/capture/sync";
import { calculateMeterPreview } from "@/lib/billing-calculation";
import type { BillingPeriodDetailResponse, MeterReadingResponse } from "@/lib/api/types";
import FileUpload from "@/components/ui/file-upload";

export default function CaptureReadingClient({
  managerId,
  motelId,
  period,
  reading,
  roomName,
  roomReadings,
  nextUrl,
}: {
  managerId: string;
  motelId: string;
  period: BillingPeriodDetailResponse;
  reading: MeterReadingResponse;
  roomName: string;
  roomReadings: MeterReadingResponse[];
  nextUrl?: string;
}) {
  const router = useRouter();
  const queueScope = useMemo(
    () => createCaptureQueueScope(managerId, motelId, period.id),
    [managerId, motelId, period.id],
  );
  const queue = useMemo(() => new CaptureQueue(queueScope.managerId), [queueScope.managerId]);
  const [currentId, setCurrentId] = useState(reading.id);
  const active = roomReadings.find((item) => item.id === currentId) ?? reading;
  const index = roomReadings.findIndex((item) => item.id === currentId);
  const [value, setValue] = useState(active.currentReading ?? "");
  const [photo, setPhoto] = useState<File>();
  const [message, setMessage] = useState("");
  const [syncState, setSyncState] = useState("Chưa đồng bộ");
  const locked = period.status !== "draft";
  const preview = calculateMeterPreview(
    active.previousReading,
    value,
    active.type === "electric" ? period.electricityPrice : period.waterPrice,
  );
  const sync = useCallback(async () => {
    if (locked) return;
    try {
      const result = await syncCaptureQueue(
        queue,
        async (item) => {
          if (
            item.managerId !== queueScope.managerId ||
            item.motelId !== queueScope.motelId ||
            item.periodId !== queueScope.periodId
          )
            throw new Error("CAPTURE_QUEUE_SCOPE_MISMATCH");
          await saveCaptureReadings(item.motelId, item.periodId, { readings: item.readings });
        },
        async (item) => {
          if (
            item.managerId !== queueScope.managerId ||
            item.motelId !== queueScope.motelId ||
            item.periodId !== queueScope.periodId
          )
            throw new Error("CAPTURE_QUEUE_SCOPE_MISMATCH");
          await uploadMeterPhoto(
            item.motelId,
            item.periodId,
            item.readingId,
            new File([item.file], "meter-photo", { type: item.file.type }),
          );
        },
        { motelId: queueScope.motelId, periodId: queueScope.periodId },
      );
      setSyncState(
        result.readings.conflicts
          ? "Cần kiểm tra xung đột"
          : result.readings.failed || result.photos.failed
            ? "Đang chờ kết nối"
            : result.readings.sent || result.photos.sent
              ? "Đã đồng bộ"
              : "Đã lưu trên thiết bị",
      );
    } catch {
      setSyncState("Ngoại tuyến · hàng đợi giữ trên thiết bị");
    }
  }, [locked, queue, queueScope]);
  useEffect(() => {
    const timer = window.setTimeout(() => void sync(), 0);
    const onReconnect = () => void sync();
    window.addEventListener("online", onReconnect);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", onReconnect);
    };
  }, [sync]);
  const move = (next: MeterReadingResponse) => {
    setCurrentId(next.id);
    setValue(next.currentReading ?? "");
    setPhoto(undefined);
    setMessage("");
  };
  const next = roomReadings[index + 1];
  const canComplete =
    !locked &&
    period.rooms
      .flatMap((room) => room.readings)
      .every((item) => {
        const current = item.id === active.id ? value : item.currentReading;
        return (
          current !== null &&
          calculateMeterPreview(
            item.previousReading,
            current,
            item.type === "electric" ? period.electricityPrice : period.waterPrice,
          ) !== null
        );
      });
  async function save(nextReading?: MeterReadingResponse) {
    if (locked) return;
    try {
      await queue.enqueue({
        managerId: queueScope.managerId,
        motelId: queueScope.motelId,
        periodId: queueScope.periodId,
        periodStatus: "draft",
        readings: [
          {
            roomId: active.roomId,
            type: active.type,
            currentReading: value,
            expectedUpdatedAt: active.updatedAt,
          },
        ],
      });
      if (photo)
        await queue.enqueuePhoto({
          managerId: queueScope.managerId,
          motelId: queueScope.motelId,
          periodId: queueScope.periodId,
          readingId: active.id,
          periodStatus: "draft",
          file: photo,
        });
      await sync();
      setMessage("Đã lưu chỉ số");
      if (nextReading) move(nextReading);
      else if (nextUrl) router.push(nextUrl);
    } catch (error) {
      setMessage(
        error instanceof CaptureQueueUnavailableError
          ? "Thiết bị không hỗ trợ lưu ngoại tuyến."
          : isReadingConflict(error)
            ? "Xung đột: chỉ số máy chủ đã đổi. Nhập lại."
            : "Không thể lưu chỉ số",
      );
    }
  }
  const title = useMemo(
    () => `${roomName} · ${active.type === "electric" ? "Điện" : "Nước"}`,
    [roomName, active.type],
  );
  return (
    <section
      style={{ width: "100%", maxWidth: "min(100%, 32rem)" }}
      className="mx-auto min-w-0 space-y-5 pb-6"
    >
      <button
        className="min-h-11 text-sm font-semibold text-primary"
        onClick={() => router.push(`/capture/${period.id}?motel=${encodeURIComponent(motelId)}`)}
      >
        ← Danh sách phòng
      </button>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 font-heading text-2xl font-bold [overflow-wrap:anywhere]">
          {title}
        </h1>
        <span className="rounded-full bg-primary-fixed px-3 py-1 text-sm font-semibold text-on-primary-fixed">
          {index + 1}/{roomReadings.length}
        </span>
      </div>
      <p className="text-text-muted">Chỉ số trước: {active.previousReading}</p>
      {locked && (
        <p
          role="status"
          className="rounded-card border border-warning bg-warning-bg p-3 text-warning"
        >
          Kỳ đã chốt · Chỉ xem
        </p>
      )}
      <label className="block space-y-2">
        Chỉ số hiện tại
        <input
          disabled={locked}
          autoFocus
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-14 w-full rounded-input border border-border px-4 text-2xl"
        />
      </label>
      {preview && (
        <p className="rounded-card border border-border bg-surface p-3">
          Dùng {preview.usage} · Ước tính {preview.cost} ₫
        </p>
      )}
      <FileUpload
        id="meter-photo"
        label="Ảnh công tơ"
        maxBytes={10 * 1024 * 1024}
        disabled={locked}
        capture="environment"
        previewUrl={photo ? URL.createObjectURL(photo) : undefined}
        onRemovePreview={() => setPhoto(undefined)}
        onFiles={(files) => setPhoto(files[0])}
      />
      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
      <p role="status" className="text-sm text-text-muted">
        {syncState}
      </p>
      <div className="flex min-w-0 flex-wrap gap-2">
        <button
          disabled={locked}
          onClick={() => void save(next)}
          className="min-h-12 flex-1 rounded-input bg-primary px-4 font-semibold text-surface disabled:opacity-50"
        >
          {next ? "Lưu và tiếp" : nextUrl ? "Lưu và sang phòng tiếp" : "Lưu"}
        </button>
        {!next && (
          <button
            disabled={!canComplete}
            onClick={() => void save()}
            className="min-h-12 min-w-0 max-w-full rounded-input border border-border px-4 [overflow-wrap:anywhere]"
          >
            Hoàn tất & tạo hóa đơn
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="rounded-card border border-border p-3">
          {message}
        </p>
      )}
    </section>
  );
}
