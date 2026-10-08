import type { CaptureQueueItem, CaptureQueueInput, CaptureQueueStatus } from "./types";

const DB_NAME = "motel-capture";
const STORE = "queue";
const memory = new Map<string, CaptureQueueItem>();

function idb(): IDBFactory | undefined { return typeof indexedDB === "undefined" ? undefined : indexedDB; }

async function openDb(): Promise<IDBDatabase | undefined> {
  const factory = idb();
  if (!factory) return undefined;
  return new Promise((resolve, reject) => { const request = factory.open(DB_NAME, 1); request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  if (!db) throw new Error("IndexedDB unavailable");
  return new Promise((resolve, reject) => { const tx = db.transaction(STORE, mode); const request = action(tx.objectStore(STORE)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

export class CaptureQueue {
  constructor(private readonly managerId: string) {}

  async enqueue(input: CaptureQueueInput): Promise<string> {
    if (input.periodStatus === "closed") throw new Error("PERIOD_ALREADY_CLOSED");
    const id = crypto.randomUUID();
    const item: CaptureQueueItem = { ...input, id, status: "pending", attempts: 0, createdAt: new Date().toISOString() };
    const db = await openDb();
    if (!db) memory.set(id, item); else await transact("readwrite", (store) => store.put(item));
    return id;
  }

  async list(): Promise<CaptureQueueItem[]> {
    const db = await openDb();
    const rows = db ? await transact<CaptureQueueItem[]>("readonly", (store) => store.getAll()) : [...memory.values()];
    return rows.filter((row) => row.managerId === this.managerId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async update(id: string, status: CaptureQueueStatus): Promise<void> {
    const db = await openDb();
    if (!db) { const item = memory.get(id); if (item) memory.set(id, { ...item, status, attempts: item.attempts + 1 }); return; }
    const item = await transact<CaptureQueueItem | undefined>("readonly", (store) => store.get(id));
    if (item?.managerId === this.managerId) await transact("readwrite", (store) => store.put({ ...item, status, attempts: item.attempts + 1 }));
  }
}

export async function clearCaptureQueue(managerId: string): Promise<void> {
  const db = await openDb();
  if (!db) { for (const [id, item] of memory) if (item.managerId === managerId) memory.delete(id); return; }
  const rows = await transact<CaptureQueueItem[]>("readonly", (store) => store.getAll());
  await Promise.all(rows.filter((row) => row.managerId === managerId).map((row) => transact("readwrite", (store) => store.delete(row.id))));
}
