import type { CaptureQueue } from "./queue";
import type { CaptureQueueItem } from "./types";

export type CaptureSender = (item: CaptureQueueItem) => Promise<void>;

export async function syncCaptureQueue(queue: CaptureQueue, send: CaptureSender): Promise<void> {
  for (const item of await queue.list()) {
    if (item.status === "sent" || item.status === "conflict" || item.status === "locked") continue;
    if (item.periodStatus !== "draft") { await queue.update(item.id, "locked"); continue; }
    try { await send(item); await queue.update(item.id, "sent"); }
    catch (error) { await queue.update(item.id, error && typeof error === "object" && "code" in error && error.code === "READING_CONFLICT" ? "conflict" : "failed"); }
  }
}
