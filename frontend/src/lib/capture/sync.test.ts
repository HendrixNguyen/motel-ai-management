import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { syncCaptureQueue } from "@/lib/capture/sync";

describe("capture sync result", () => {
  it("stores server reading from ApiError details on conflict", async () => {
    const item = { id: "1", managerId: "m", motelId: "mt", periodId: "p", periodStatus: "draft" as const, readings: [], status: "pending" as const, attempts: 0, createdAt: "1" };
    let conflict: unknown;
    const queue = { list: async () => [item], update: async (_id: string, _status: string, details?: unknown) => { conflict = details; }, listPhotos: async () => [], updatePhoto: async () => undefined } as never;
    await syncCaptureQueue(queue, async () => { throw new ApiError(409, "READING_CONFLICT", "x", { server: { roomId: "room-1", type: "electric", currentReading: "42.00", updatedAt: "2026-10-08T07:00:00.000Z" } }); });
    expect(conflict).toEqual({ server: { roomId: "room-1", type: "electric", currentReading: "42.00", updatedAt: "2026-10-08T07:00:00.000Z" }, message: "Chỉ số đã thay đổi trên máy chủ" });
  });

  it("reports sent, failure, conflict, and lock counts", async () => {
    const items = [
      { id: "1", managerId: "m", motelId: "mt", periodId: "p", periodStatus: "draft" as const, readings: [], status: "pending" as const, attempts: 0, createdAt: "1" },
      { id: "2", managerId: "m", motelId: "mt", periodId: "p", periodStatus: "sent" as const, readings: [], status: "pending" as const, attempts: 0, createdAt: "2" },
    ];
    const updates: string[] = [];
    const queue = { list: async () => items, update: async (_id: string, status: string) => { updates.push(status); }, listPhotos: async () => [], updatePhoto: async () => undefined } as never;
    const result = await syncCaptureQueue(queue, async () => undefined);
    expect(result.readings).toMatchObject({ sent: 1, locked: 1 }); expect(updates).toEqual(["sent", "locked"]);
  });
});
