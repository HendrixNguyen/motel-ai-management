import { describe, expect, it } from "vitest";
import { syncCaptureQueue } from "@/lib/capture/sync";

describe("capture sync result", () => {
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
