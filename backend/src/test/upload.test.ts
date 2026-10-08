import { beforeEach, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { billingPeriods, meterReadings } from "@/modules/billing/billing.schema";
import { uploads } from "@/modules/billing/upload.schema";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { FakeStorageAdapter, type StorageAdapter, type StorageObject, type StoragePutInput } from "@/shared/storage";
import { configureUploadStorage, getMeterPhoto, uploadMeterPhoto } from "@/modules/billing/billing.service";

beforeEach(async () => { await resetDb(); configureUploadStorage(new FakeStorageAdapter()); });

async function seed(status: "draft" | "sent" = "draft") {
  const [manager] = await db.insert(managers).values({ email: `upload-${crypto.randomUUID()}@example.com`, passwordHash: "x", name: "M" }).returning();
  const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
  const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
  const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026, status }).returning();
  const [reading] = await db.insert(meterReadings).values({ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "0.00" }).returning();
  return { manager: manager!, motel: motel!, period: period!, reading: reading! };
}

const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "meter.jpg", { type: "image/jpeg" });

class ObservableStorage implements StorageAdapter {
  readonly inner = new FakeStorageAdapter();
  readonly deleted: string[] = [];
  constructor(private readonly afterPut?: () => Promise<void>) {}
  async put(input: StoragePutInput): Promise<StorageObject> { const result = await this.inner.put(input); await this.afterPut?.(); return result; }
  async delete(key: string): Promise<void> { this.deleted.push(key); await this.inner.delete(key); }
  createSignedDownload(key: string, ttl: number): Promise<string> { return this.inner.createSignedDownload(key, ttl); }
}

describe("meter photo uploads", () => {
  test("stores private metadata and returns signed read", async () => {
    const data = await seed();
    const uploaded = await uploadMeterPhoto(data.motel.id, data.period.id, data.reading.id, data.manager.id, jpeg());
    expect(uploaded).toMatchObject({ contentType: "image/jpeg", size: 4 });
    expect("objectKey" in uploaded).toBe(false);
    const read = await getMeterPhoto(data.motel.id, data.period.id, data.reading.id, data.manager.id);
    expect(read.url).toContain("fake://private/");
    expect("objectKey" in read).toBe(false);
  });

  test("replaces prior photo and rejects sent periods", async () => {
    const data = await seed();
    const first = await uploadMeterPhoto(data.motel.id, data.period.id, data.reading.id, data.manager.id, jpeg());
    const second = await uploadMeterPhoto(data.motel.id, data.period.id, data.reading.id, data.manager.id, jpeg());
    expect(second.id).not.toBe(first.id);
    const sent = await seed("sent");
    await expect(uploadMeterPhoto(sent.motel.id, sent.period.id, sent.reading.id, sent.manager.id, jpeg())).rejects.toMatchObject({ code: "PERIOD_ALREADY_SENT" });
  });

  test("rejects bad magic bytes and oversized files before storage", async () => {
    const data = await seed();
    await expect(uploadMeterPhoto(data.motel.id, data.period.id, data.reading.id, data.manager.id, new File([new Uint8Array([1, 2, 3])], "bad.jpg", { type: "image/jpeg" }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(uploadMeterPhoto(data.motel.id, data.period.id, data.reading.id, data.manager.id, new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("rolls back metadata and deletes object when linkage updates zero rows", async () => {
    const data = await seed();
    const storage = new ObservableStorage(async () => { await db.delete(meterReadings).where(eq(meterReadings.id, data.reading.id)); });
    configureUploadStorage(storage);
    await expect(uploadMeterPhoto(data.motel.id, data.period.id, data.reading.id, data.manager.id, jpeg())).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(storage.deleted).toHaveLength(1);
    expect(await db.query.uploads.findMany()).toHaveLength(0);
  });

  test("hides foreign reading and storage failures", async () => {
    const own = await seed();
    const other = await seed();
    await expect(uploadMeterPhoto(other.motel.id, own.period.id, own.reading.id, other.manager.id, jpeg())).rejects.toMatchObject({ code: "NOT_FOUND" });
    configureUploadStorage(new FakeStorageAdapter({ failure: new Error("secret bucket") }));
    await expect(uploadMeterPhoto(own.motel.id, own.period.id, own.reading.id, own.manager.id, jpeg())).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });
});
