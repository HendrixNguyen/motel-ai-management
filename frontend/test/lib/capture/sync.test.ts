import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { syncCaptureQueue } from "@/lib/capture/sync";

describe("capture sync result", () => {
  it("stores server reading from ApiError details on conflict", async () => {
    const item = {
      id: "1",
      managerId: "m",
      motelId: "mt",
      periodId: "p",
      periodStatus: "draft" as const,
      readings: [],
      status: "pending" as const,
      attempts: 0,
      createdAt: "1",
    };
    let conflict: unknown;
    const queue = {
      list: async () => [item],
      update: async (_id: string, _status: string, details?: unknown) => {
        conflict = details;
      },
      listPhotos: async () => [],
      updatePhoto: async () => undefined,
    } as never;
    await syncCaptureQueue(queue, async () => {
      throw new ApiError(409, "READING_CONFLICT", "x", {
        server: {
          roomId: "room-1",
          type: "electric",
          currentReading: "42.00",
          updatedAt: "2026-10-08T07:00:00.000Z",
        },
      });
    });
    expect(conflict).toEqual({
      server: {
        roomId: "room-1",
        type: "electric",
        currentReading: "42.00",
        updatedAt: "2026-10-08T07:00:00.000Z",
      },
      message: "Chỉ số đã thay đổi trên máy chủ",
    });
  });

  it("stores null for malformed server reading details", async () => {
    const item = {
      id: "1",
      managerId: "m",
      motelId: "mt",
      periodId: "p",
      periodStatus: "draft" as const,
      readings: [],
      status: "pending" as const,
      attempts: 0,
      createdAt: "1",
    };
    let conflict: unknown;
    const queue = {
      list: async () => [item],
      update: async (_id: string, _status: string, details?: unknown) => {
        conflict = details;
      },
      listPhotos: async () => [],
      updatePhoto: async () => undefined,
    } as never;
    await syncCaptureQueue(queue, async () => {
      throw new ApiError(409, "READING_CONFLICT", "x", { server: { roomId: "room-1" } });
    });
    expect(conflict).toEqual({ server: null, message: "Chỉ số đã thay đổi trên máy chủ" });
  });

  it("skips already sent, conflicted and locked readings, and returns before photos without a sender", async () => {
    const skipped = ["sent", "conflict", "locked"].map((status, i) => ({
      id: String(i),
      managerId: "m",
      motelId: "mt",
      periodId: "p",
      periodStatus: "draft" as const,
      readings: [],
      status,
      attempts: 0,
      createdAt: String(i),
    }));
    let photoReads = 0;
    const queue = {
      list: async () => skipped,
      update: async () => {
        throw new Error("must not update skipped row");
      },
      listPhotos: async () => {
        photoReads++;
        return [];
      },
      updatePhoto: async () => undefined,
    } as never;
    const result = await syncCaptureQueue(queue, async () => {
      throw new Error("must skip terminal statuses");
    });
    expect(result.readings).toEqual({ sent: 0, failed: 0, conflicts: 0, locked: 0 });
    expect(photoReads).toBe(0);
  });

  it("distinguishes malformed and valid reading conflicts and failed transport", async () => {
    const items = ["bad", "good", "fail"].map((id) => ({
      id,
      managerId: "m",
      motelId: "mt",
      periodId: "p",
      periodStatus: "draft" as const,
      readings: [],
      status: "pending" as const,
      attempts: 0,
      createdAt: id,
    }));
    const statuses: Array<[string, string, unknown]> = [];
    const queue = {
      list: async () => items,
      update: async (id: string, status: string, details?: unknown) => {
        statuses.push([id, status, details]);
      },
      listPhotos: async () => [],
      updatePhoto: async () => undefined,
    } as never;
    let index = 0;
    const result = await syncCaptureQueue(queue, async () => {
      const current = index++;
      if (current === 0) throw { code: "READING_CONFLICT", details: { server: { roomId: "bad" } } };
      if (current === 1)
        throw {
          code: "READING_CONFLICT",
          details: {
            server: { roomId: "r", type: "water", currentReading: null, updatedAt: "timestamp" },
          },
        };
      throw new Error("network");
    });
    expect(result.readings).toEqual({ sent: 0, failed: 1, conflicts: 2, locked: 0 });
    expect(statuses).toEqual([
      ["bad", "conflict", { server: null, message: "Chỉ số đã thay đổi trên máy chủ" }],
      [
        "good",
        "conflict",
        {
          server: { roomId: "r", type: "water", currentReading: null, updatedAt: "timestamp" },
          message: "Chỉ số đã thay đổi trên máy chủ",
        },
      ],
      ["fail", "failed", undefined],
    ]);
  });

  it("sends photos, skips sent/locked rows, and locks photos from closed periods", async () => {
    const items = [
      {
        id: "sent",
        managerId: "m",
        motelId: "mt",
        periodId: "p",
        readingId: "r",
        periodStatus: "draft" as const,
        file: new Blob(),
        status: "sent" as const,
        attempts: 0,
        createdAt: "1",
      },
      {
        id: "locked",
        managerId: "m",
        motelId: "mt",
        periodId: "p",
        readingId: "r",
        periodStatus: "draft" as const,
        file: new Blob(),
        status: "locked" as const,
        attempts: 0,
        createdAt: "2",
      },
      {
        id: "closed",
        managerId: "m",
        motelId: "mt",
        periodId: "p",
        readingId: "r",
        periodStatus: "sent" as const,
        file: new Blob(),
        status: "pending" as const,
        attempts: 0,
        createdAt: "3",
      },
      {
        id: "photo",
        managerId: "m",
        motelId: "mt",
        periodId: "p",
        readingId: "r",
        periodStatus: "draft" as const,
        file: new Blob(),
        status: "pending" as const,
        attempts: 0,
        createdAt: "4",
      },
    ];
    const updates: Array<[string, string]> = [];
    const queue = {
      list: async () => [],
      update: async () => undefined,
      listPhotos: async () => items,
      updatePhoto: async (id: string, status: string) => {
        updates.push([id, status]);
      },
    } as never;
    const result = await syncCaptureQueue(
      queue,
      async () => undefined,
      async (item) => {
        if (item.id === "photo") throw new Error("upload failed");
      },
    );
    expect(result.photos).toEqual({ sent: 0, failed: 1, locked: 1 });
    expect(updates).toEqual([
      ["closed", "locked"],
      ["photo", "failed"],
    ]);
  });

  it("reports sent, failure, conflict, and lock counts", async () => {
    const items = [
      {
        id: "1",
        managerId: "m",
        motelId: "mt",
        periodId: "p",
        periodStatus: "draft" as const,
        readings: [],
        status: "pending" as const,
        attempts: 0,
        createdAt: "1",
      },
      {
        id: "2",
        managerId: "m",
        motelId: "mt",
        periodId: "p",
        periodStatus: "sent" as const,
        readings: [],
        status: "pending" as const,
        attempts: 0,
        createdAt: "2",
      },
    ];
    const updates: string[] = [];
    const queue = {
      list: async () => items,
      update: async (_id: string, status: string) => {
        updates.push(status);
      },
      listPhotos: async () => [],
      updatePhoto: async () => undefined,
    } as never;
    const result = await syncCaptureQueue(queue, async () => undefined);
    expect(result.readings).toMatchObject({ sent: 1, locked: 1 });
    expect(updates).toEqual(["sent", "locked"]);
  });
});
