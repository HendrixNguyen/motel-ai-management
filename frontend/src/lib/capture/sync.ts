import type { CaptureQueue } from "./queue";
import type { CaptureQueueItem } from "./types";

export type CaptureSender = (item: CaptureQueueItem) => Promise<void>;
export type PhotoSender = (item: Awaited<ReturnType<CaptureQueue["listPhotos"]>>[number]) => Promise<unknown>;

export async function syncCaptureQueue(queue: CaptureQueue, send: CaptureSender, sendPhoto?: PhotoSender): Promise<void> {
  for (const item of await queue.list()) {
    if (["sent", "conflict", "locked"].includes(item.status)) continue;
    if (item.periodStatus !== "draft") { await queue.update(item.id, "locked"); continue; }
    try { await send(item); await queue.update(item.id, "sent"); }
    catch (error) { const conflict = error && typeof error === "object" && "code" in error && error.code === "READING_CONFLICT"; await queue.update(item.id, conflict ? "conflict" : "failed", conflict ? { server: "server" in (error as object) && typeof (error as { server?: unknown }).server === "string" ? (error as unknown as { server: string }).server : null, message: "Chỉ số đã thay đổi trên máy chủ" } : undefined); }
  }
  if (!sendPhoto) return;
  for (const item of await queue.listPhotos()) {
    if (["sent", "locked"].includes(item.status)) continue;
    if (item.periodStatus !== "draft") { await queue.updatePhoto(item.id, "locked"); continue; }
    try { await sendPhoto(item); await queue.updatePhoto(item.id, "sent"); } catch { await queue.updatePhoto(item.id, "failed"); }
  }
}
