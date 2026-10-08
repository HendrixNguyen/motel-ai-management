import { beforeEach, describe, expect, test } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { billingPeriods, meterReadings } from "@/modules/billing/billing.schema";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { FakeStorageAdapter } from "@/shared/storage";
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

  test("cleans uploaded object when reading linkage updates no rows", async () => {
    const data = await seed();
    const storage = new FakeStorageAdapter();
    configureUploadStorage(storage);
    await expect(uploadMeterPhoto(data.motel.id, data.period.id, "00000000-0000-0000-0000-000000000000", data.manager.id, jpeg())).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("hides foreign reading and storage failures", async () => {
    const own = await seed();
    const other = await seed();
    await expect(uploadMeterPhoto(other.motel.id, own.period.id, own.reading.id, other.manager.id, jpeg())).rejects.toMatchObject({ code: "NOT_FOUND" });
    configureUploadStorage(new FakeStorageAdapter({ failure: new Error("secret bucket") }));
    await expect(uploadMeterPhoto(own.motel.id, own.period.id, own.reading.id, own.manager.id, jpeg())).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });
});
