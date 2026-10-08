import { describe, expect, it } from "vitest";
import { CaptureQueue, CaptureQueueUnavailableError, clearCaptureQueue } from "@/lib/capture/queue";

describe("capture queue", () => {
  it("refuses unsupported storage instead of using volatile memory", async () => {
    if (typeof indexedDB !== "undefined") return;
    await expect(new CaptureQueue("manager-1").list()).rejects.toBeInstanceOf(CaptureQueueUnavailableError);
    await expect(clearCaptureQueue("manager-1")).resolves.toBeUndefined();
  });

  it("rejects writes for another manager before storage", async () => {
    await expect(new CaptureQueue("manager-1").enqueue({ managerId: "manager-2", motelId: "motel-1", periodId: "period-1", periodStatus: "draft", readings: [] })).rejects.toThrow("CAPTURE_QUEUE_MANAGER_MISMATCH");
  });

  it("rejects writes for sent or closed periods before storage", async () => {
    const queue = new CaptureQueue("manager-1");
    await expect(queue.enqueue({ managerId: "manager-1", motelId: "motel-1", periodId: "period-1", periodStatus: "sent", readings: [] })).rejects.toThrow("PERIOD_NOT_DRAFT");
    await expect(queue.enqueue({ managerId: "manager-1", motelId: "motel-1", periodId: "period-1", periodStatus: "closed", readings: [] })).rejects.toThrow("PERIOD_NOT_DRAFT");
  });
});
