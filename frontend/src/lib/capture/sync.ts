import type { CaptureQueue } from "./queue";
import type { CaptureQueueItem } from "./types";

export type CaptureSender = (item: CaptureQueueItem) => Promise<void>;
export type PhotoSender = (item: Awaited<ReturnType<CaptureQueue["listPhotos"]>>[number]) => Promise<unknown>;

export type SyncResult = { readings: { sent: number; failed: number; conflicts: number; locked: number }; photos: { sent: number; failed: number; locked: number } };

export async function syncCaptureQueue(queue: CaptureQueue, send: CaptureSender, sendPhoto?: PhotoSender): Promise<SyncResult> {
  const result: SyncResult = { readings: { sent: 0, failed: 0, conflicts: 0, locked: 0 }, photos: { sent: 0, failed: 0, locked: 0 } };
  for (const item of await queue.list()) {
    if (["sent", "conflict", "locked"].includes(item.status)) continue;
    if (item.periodStatus !== "draft") { await queue.update(item.id, "locked"); result.readings.locked += 1; continue; }
    try { await send(item); await queue.update(item.id, "sent"); result.readings.sent += 1; }
    catch (error) { const conflict = error && typeof error === "object" && "code" in error && error.code === "READING_CONFLICT"; const details = error && typeof error === "object" && "details" in error && typeof error.details === "object" && error.details !== null ? error.details as { server?: unknown } : undefined; await queue.update(item.id, conflict ? "conflict" : "failed", conflict ? { server: typeof details?.server === "string" ? details.server : null, message: "Chỉ số đã thay đổi trên máy chủ" } : undefined); if (conflict) result.readings.conflicts += 1; else result.readings.failed += 1; }
  }
  if (!sendPhoto) return result;
  for (const item of await queue.listPhotos()) {
    if (["sent", "locked"].includes(item.status)) continue;
    if (item.periodStatus !== "draft") { await queue.updatePhoto(item.id, "locked"); result.photos.locked += 1; continue; }
    try { await sendPhoto(item); await queue.updatePhoto(item.id, "sent"); result.photos.sent += 1; } catch { await queue.updatePhoto(item.id, "failed"); result.photos.failed += 1; }
  }
  return result;
}
