import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureQueue, clearAllCaptureQueue, clearCaptureQueue } from "@/lib/capture/queue";

const stores = new Map<string, Map<string, unknown>>();
function createRequest<T>(value: T): IDBRequest<T> {
  const state: { value: T } = { value };
  const request = {
    get result() {
      return state.value;
    },
    error: null,
    onsuccess: null as ((event: Event) => void) | null,
    onerror: null as ((event: Event) => void) | null,
  } as IDBRequest<T>;
  queueMicrotask(() => {
    request.onsuccess?.(new Event("success"));
  });
  return request;
}
function fakeIndexedDB() {
  stores.clear();
  const factory = {
    open: vi.fn(() => {
      const state: { value?: IDBDatabase } = {};
      const request = {
        get result() {
          return state.value!;
        },
        error: null,
        onsuccess: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onupgradeneeded: null as ((event: IDBVersionChangeEvent) => void) | null,
      } as IDBOpenDBRequest;
      const objectStoreNames = { contains: (name: string) => stores.has(name) } as DOMStringList;
      const db = {
        objectStoreNames,
        createObjectStore: (name: string) => {
          stores.set(name, new Map());
          return {};
        },
        transaction: (name: string, mode: IDBTransactionMode) => {
          const map = stores.get(name)!;
          const store = {
            getAll: () => createRequest([...map.values()]),
            get: (id: string) => createRequest(map.get(id)),
            put: (row: { id: string }) => {
              map.set(row.id, row);
              return createRequest(row.id);
            },
            delete: (id: string) => {
              map.delete(id);
              return createRequest(undefined);
            },
            clear: () => {
              map.clear();
              return createRequest(undefined);
            },
          };
          return { objectStore: () => store, mode } as unknown as IDBTransaction;
        },
      } as unknown as IDBDatabase;
      state.value = db;
      queueMicrotask(() => {
        request.onupgradeneeded?.(new Event("upgradeneeded") as IDBVersionChangeEvent);
        request.onsuccess?.(new Event("success"));
      });
      return request;
    }),
  } as unknown as IDBFactory;
  return factory;
}

describe("CaptureQueue persistent data and boundary branches", () => {
  const prior = globalThis.indexedDB;
  beforeEach(() => {
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: fakeIndexedDB() });
    vi.spyOn(crypto, "randomUUID").mockReturnValue("queue-id");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: prior });
  });

  it("enqueues, filters by tenant/motel/period, sorts, and updates attempts", async () => {
    const queue = new CaptureQueue("manager-1");
    await queue.enqueue({
      managerId: "manager-1",
      motelId: "motel-1",
      periodId: "period-1",
      periodStatus: "draft",
      readings: [
        { roomId: "room-1", type: "electric", currentReading: "10", expectedUpdatedAt: "ts" },
      ],
    });
    const rows = await queue.list("motel-1", "period-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "queue-id", status: "pending", attempts: 0 });
    await queue.update("queue-id", "conflict", { server: null, message: "stale" });
    expect((await queue.list())[0]).toMatchObject({
      status: "conflict",
      attempts: 1,
      conflict: { message: "stale" },
    });
    expect(await new CaptureQueue("manager-2").list()).toEqual([]);
    expect(await queue.list("other-motel")).toEqual([]);
  });

  it("queues photos independently and leaves other owners' rows unchanged", async () => {
    const queue = new CaptureQueue("manager-1");
    await queue.enqueuePhoto({
      managerId: "manager-1",
      motelId: "motel-1",
      periodId: "period-1",
      readingId: "reading-1",
      periodStatus: "draft",
      file: new Blob(["jpeg"], { type: "image/jpeg" }),
    });
    await queue.updatePhoto("queue-id", "sent");
    expect(await queue.listPhotos("motel-1", "period-1")).toMatchObject([
      { status: "sent", attempts: 1, readingId: "reading-1" },
    ]);
    await new CaptureQueue("manager-2").updatePhoto("queue-id", "failed");
    expect((await queue.listPhotos())[0]?.status).toBe("sent");
  });

  it("detects legacy browser rows only when unsent", async () => {
    const queue = new CaptureQueue("manager-1");
    stores.set(
      "readings",
      new Map([
        ["sent", { id: "sent", managerId: "browser", status: "sent" }],
        ["pending", { id: "pending", managerId: "browser", status: "pending" }],
      ]),
    );
    stores.set("photos", new Map());
    expect(await queue.hasLegacyRows()).toBe(true);
    stores.set(
      "readings",
      new Map([["sent", { id: "sent", managerId: "browser", status: "sent" }]]),
    );
    expect(await queue.hasLegacyRows()).toBe(false);
  });

  it("clears only matching owner or all local queue stores", async () => {
    const queue = new CaptureQueue("manager-1");
    await queue.enqueue({
      managerId: "manager-1",
      motelId: "motel-1",
      periodId: "p1",
      periodStatus: "draft",
      readings: [],
    });
    vi.spyOn(crypto, "randomUUID").mockReturnValue("other-id");
    await new CaptureQueue("manager-2").enqueuePhoto({
      managerId: "manager-2",
      motelId: "motel-2",
      periodId: "p2",
      readingId: "r2",
      periodStatus: "draft",
      file: new Blob(["x"]),
    });
    await clearCaptureQueue("manager-1");
    expect(await queue.list()).toEqual([]);
    expect(await new CaptureQueue("manager-2").listPhotos()).toHaveLength(1);
    await clearAllCaptureQueue();
    expect(await new CaptureQueue("manager-2").listPhotos()).toEqual([]);
  });
});
