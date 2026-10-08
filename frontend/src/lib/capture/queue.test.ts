import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureQueue, clearCaptureQueue } from "@/lib/capture/queue";
import { syncCaptureQueue } from "@/lib/capture/sync";

const reading = { roomId: "room-1", type: "electric" as const, currentReading: "12.50", expectedUpdatedAt: "2026-01-01T00:00:00.000Z" };

beforeEach(async () => { await clearCaptureQueue("manager-1"); });

describe("capture queue", () => {
  it("persists queued readings across queue instances", async () => {
    const first = new CaptureQueue("manager-1");
    await first.enqueue({ managerId: "manager-1", motelId: "motel-1", periodId: "period-1", periodStatus: "draft", readings: [reading] });
    const second = new CaptureQueue("manager-1");
    await expect(second.list()).resolves.toMatchObject([{ status: "pending", readings: [reading] }]);
  });

  it("retries failed writes and marks successful writes sent", async () => {
    const queue = new CaptureQueue("manager-1");
    await queue.enqueue({ managerId: "manager-1", motelId: "motel-1", periodId: "period-1", periodStatus: "draft", readings: [reading] });
    const send = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    await syncCaptureQueue(queue, send);
    expect((await queue.list())[0]?.status).toBe("failed");
    await syncCaptureQueue(queue, send);
    expect((await queue.list())[0]?.status).toBe("sent");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("keeps conflicts visible and does not retry sent periods", async () => {
    const queue = new CaptureQueue("manager-1");
    const conflict = await queue.enqueue({ managerId: "manager-1", motelId: "motel-1", periodId: "period-1", periodStatus: "draft", readings: [reading] });
    const sent = await queue.enqueue({ managerId: "manager-1", motelId: "motel-1", periodId: "period-2", periodStatus: "sent", readings: [reading] });
    const send = vi.fn().mockRejectedValue({ code: "READING_CONFLICT" });
    await syncCaptureQueue(queue, send);
    const rows = await queue.list();
    expect(rows.find((row) => row.id === conflict)?.status).toBe("conflict");
    expect(rows.find((row) => row.id === sent)?.status).toBe("locked");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("clears all manager capture data on logout", async () => {
    const queue = new CaptureQueue("manager-1");
    await queue.enqueue({ managerId: "manager-1", motelId: "motel-1", periodId: "period-1", periodStatus: "draft", readings: [reading] });
    await clearCaptureQueue("manager-1");
    await expect(queue.list()).resolves.toEqual([]);
  });
});
