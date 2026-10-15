import { describe, expect, it } from "vitest";
import { CaptureQueue } from "@/lib/capture/queue";
import { syncCaptureQueue } from "@/lib/capture/sync";

describe("capture queue context isolation", () => {
  it("only syncs current manager, motel and period records", async () => {
    const queued = [
      { id: "current", managerId: "m1", motelId: "house-a", periodId: "p1", periodStatus: "draft" as const, readings: [], status: "pending" as const, attempts: 0, createdAt: "1" },
      { id: "other-motel", managerId: "m1", motelId: "house-b", periodId: "p1", periodStatus: "draft" as const, readings: [], status: "pending" as const, attempts: 0, createdAt: "2" },
      { id: "other-period", managerId: "m1", motelId: "house-a", periodId: "p2", periodStatus: "draft" as const, readings: [], status: "pending" as const, attempts: 0, createdAt: "3" },
    ];
    const sent: string[] = [];
    const queue = { list: async (motelId?: string, periodId?: string) => queued.filter((item) => (!motelId || item.motelId === motelId) && (!periodId || item.periodId === periodId)), listPhotos: async () => [], update: async () => undefined, updatePhoto: async () => undefined } as unknown as CaptureQueue;
    const result = await syncCaptureQueue(queue, async (item) => { sent.push(item.id); }, undefined, { motelId: "house-a", periodId: "p1" });
    expect(sent).toEqual(["current"]);
    expect(result.readings.sent).toBe(1);
  });
});
