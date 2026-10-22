import { describe, expect, it } from "vitest";
import { CaptureQueue, CaptureQueueUnavailableError, clearCaptureQueue } from "@/lib/capture/queue";

describe("capture queue", () => {
  it("refuses unsupported storage instead of using volatile memory", async () => {
    if (typeof indexedDB !== "undefined") return;
    const queue = new CaptureQueue("manager-1");
    await expect(queue.list()).rejects.toBeInstanceOf(CaptureQueueUnavailableError);
    await expect(
      queue.enqueue({
        managerId: "manager-1",
        motelId: "motel-1",
        periodId: "period-1",
        periodStatus: "draft",
        readings: [],
      }),
    ).rejects.toBeInstanceOf(CaptureQueueUnavailableError);
    await expect(clearCaptureQueue("manager-1")).resolves.toBeUndefined();
  });

  it("rejects forged manager identity before any IndexedDB access", async () => {
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
    try {
      await expect(
        new CaptureQueue("manager-1").enqueue({
          managerId: "manager-2",
          motelId: "motel-1",
          periodId: "period-1",
          periodStatus: "draft",
          readings: [],
        }),
      ).rejects.toThrow("CAPTURE_QUEUE_MANAGER_MISMATCH");
    } finally {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: original });
    }
  });

  it("rejects forged photo owner before any IndexedDB access", async () => {
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
    try {
      await expect(
        new CaptureQueue("manager-1").enqueuePhoto({
          managerId: "manager-2",
          motelId: "motel-1",
          periodId: "period-1",
          readingId: "reading-1",
          periodStatus: "draft",
          file: new Blob(["x"], { type: "image/jpeg" }),
        }),
      ).rejects.toThrow("CAPTURE_QUEUE_MANAGER_MISMATCH");
    } finally {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: original });
    }
  });

  it("does not expose another manager queue when storage is unsupported", async () => {
    const queue = new CaptureQueue("manager-1");
    await expect(queue.list("motel-1", "period-1")).rejects.toBeInstanceOf(
      CaptureQueueUnavailableError,
    );
  });

  it("requires the authenticated owner identity before accepting legacy browser rows", async () => {
    const queue = new CaptureQueue("manager-1");
    await expect(
      queue.enqueue({
        managerId: "browser",
        motelId: "motel-1",
        periodId: "period-1",
        periodStatus: "draft",
        readings: [],
      }),
    ).rejects.toThrow("CAPTURE_QUEUE_MANAGER_MISMATCH");
  });

  it("rejects writes for sent or closed periods before storage", async () => {
    const queue = new CaptureQueue("manager-1");
    await expect(
      queue.enqueue({
        managerId: "manager-1",
        motelId: "motel-1",
        periodId: "period-1",
        periodStatus: "sent",
        readings: [],
      }),
    ).rejects.toThrow("PERIOD_NOT_DRAFT");
    await expect(
      queue.enqueue({
        managerId: "manager-1",
        motelId: "motel-1",
        periodId: "period-1",
        periodStatus: "closed",
        readings: [],
      }),
    ).rejects.toThrow("PERIOD_NOT_DRAFT");
  });
});
