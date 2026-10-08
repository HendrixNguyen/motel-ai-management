import type { CapturePhotoItem, CaptureQueueItem, CaptureQueueInput, CaptureQueueStatus } from "./types";

const DB_NAME = "motel-capture";
const DB_VERSION = 2;
const READINGS = "readings";
const PHOTOS = "photos";

export class CaptureQueueUnavailableError extends Error {
  constructor() { super("CAPTURE_QUEUE_UNSUPPORTED"); this.name = "CaptureQueueUnavailableError"; }
}

function requireIndexedDb(): IDBFactory {
  if (typeof indexedDB === "undefined") throw new CaptureQueueUnavailableError();
  return indexedDB;
}

function request<T>(value: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); }); }

async function database(): Promise<IDBDatabase> {
  const open = requireIndexedDb().open(DB_NAME, DB_VERSION);
  open.onupgradeneeded = () => { const db = open.result; if (!db.objectStoreNames.contains(READINGS)) db.createObjectStore(READINGS, { keyPath: "id" }); if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS, { keyPath: "id" }); };
  return request(open);
}

export class CaptureQueue {
  constructor(private readonly managerId: string) {}

  async enqueue(input: CaptureQueueInput): Promise<string> {
    if (input.periodStatus !== "draft") throw new Error("PERIOD_NOT_DRAFT");
    const id = crypto.randomUUID();
    const row: CaptureQueueItem = { ...input, id, status: "pending", attempts: 0, createdAt: new Date().toISOString() };
    const db = await database(); const tx = db.transaction(READINGS, "readwrite"); tx.objectStore(READINGS).put(row); await request(tx.objectStore(READINGS).get(id)); return id;
  }

  async enqueuePhoto(input: Omit<CapturePhotoItem, "id" | "status" | "attempts" | "createdAt">): Promise<string> {
    if (input.periodStatus !== "draft") throw new Error("PERIOD_NOT_DRAFT");
    const id = crypto.randomUUID(); const row: CapturePhotoItem = { ...input, id, status: "pending", attempts: 0, createdAt: new Date().toISOString() };
    const db = await database(); await request(db.transaction(PHOTOS, "readwrite").objectStore(PHOTOS).put(row)); return id;
  }

  async list(motelId?: string, periodId?: string): Promise<CaptureQueueItem[]> { const db = await database(); const rows = await request(db.transaction(READINGS, "readonly").objectStore(READINGS).getAll()) as CaptureQueueItem[]; return rows.filter((row) => row.managerId === this.managerId && (motelId === undefined || row.motelId === motelId) && (periodId === undefined || row.periodId === periodId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
  async listPhotos(motelId?: string, periodId?: string): Promise<CapturePhotoItem[]> { const db = await database(); const rows = await request(db.transaction(PHOTOS, "readonly").objectStore(PHOTOS).getAll()) as CapturePhotoItem[]; return rows.filter((row) => row.managerId === this.managerId && (motelId === undefined || row.motelId === motelId) && (periodId === undefined || row.periodId === periodId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }

  async update(id: string, status: CaptureQueueStatus, details?: CaptureQueueItem["conflict"]): Promise<void> { const db = await database(); const store = db.transaction(READINGS, "readwrite").objectStore(READINGS); const item = await request(store.get(id)) as CaptureQueueItem | undefined; if (item?.managerId === this.managerId) await request(store.put({ ...item, status, conflict: details, attempts: item.attempts + 1 })); }
  async updatePhoto(id: string, status: CapturePhotoItem["status"]): Promise<void> { const db = await database(); const store = db.transaction(PHOTOS, "readwrite").objectStore(PHOTOS); const item = await request(store.get(id)) as CapturePhotoItem | undefined; if (item?.managerId === this.managerId) await request(store.put({ ...item, status, attempts: item.attempts + 1 })); }
}

export async function clearCaptureQueue(managerId: string): Promise<void> { if (typeof indexedDB === "undefined") return; const db = await database(); for (const name of [READINGS, PHOTOS]) { const store = db.transaction(name, "readwrite").objectStore(name); const rows = await request(store.getAll()) as Array<{ id: string; managerId: string }>; await Promise.all(rows.filter((row) => row.managerId === managerId).map((row) => request(store.delete(row.id)))); } }

export async function clearAllCaptureQueue(): Promise<void> { if (typeof indexedDB === "undefined") return; const db = await database(); for (const name of [READINGS, PHOTOS]) await request(db.transaction(name, "readwrite").objectStore(name).clear()); }
