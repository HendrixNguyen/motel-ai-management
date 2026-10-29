import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { app } from "@/app";
import { renters } from "@/modules/renter/renter.schema";
import { billingPeriods, meterReadings } from "@/modules/billing/billing.schema";
import { uploads } from "@/modules/billing/upload.schema";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import {
  FakeStorageAdapter,
  type StorageAdapter,
  type StorageObject,
  type StoragePutInput,
} from "@/shared/storage";
import {
  configureUploadStorage,
  getMeterPhoto,
  uploadMeterPhoto,
} from "@/modules/billing/billing.service";
import { configureCccdStorage } from "@/modules/renter/renter.route";

setDefaultTimeout(120_000);
beforeEach(async () => {
  await resetDb();
  configureUploadStorage(new FakeStorageAdapter());
  configureCccdStorage(new FakeStorageAdapter());
});

async function seed(status: "draft" | "sent" = "draft") {
  const [manager] = await db
    .insert(managers)
    .values({ email: `upload-${crypto.randomUUID()}@example.com`, passwordHash: "x", name: "M" })
    .returning();
  const [motel] = await db
    .insert(motels)
    .values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" })
    .returning();
  const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
  const [period] = await db
    .insert(billingPeriods)
    .values({ motelId: motel!.id, month: 1, year: 2026, status })
    .returning();
  const [reading] = await db
    .insert(meterReadings)
    .values({
      billingPeriodId: period!.id,
      roomId: room!.id,
      type: "electric",
      previousReading: "0.00",
    })
    .returning();
  return { manager: manager!, motel: motel!, period: period!, reading: reading! };
}

const jpeg = () =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "meter.jpg", { type: "image/jpeg" });

class ObservableStorage implements StorageAdapter {
  readonly inner = new FakeStorageAdapter();
  readonly deleted: string[] = [];
  lastPutKey: string | undefined;
  constructor(private readonly afterPut?: () => Promise<void>) {}
  async put(input: StoragePutInput): Promise<StorageObject> {
    const result = await this.inner.put(input);
    this.lastPutKey = result.objectKey;
    await this.afterPut?.();
    return result;
  }
  async delete(key: string): Promise<void> {
    this.deleted.push(key);
    await this.inner.delete(key);
  }
  async exists(key: string): Promise<boolean> {
    return this.inner
      .createSignedDownload(key, 60)
      .then(() => true)
      .catch(() => false);
  }
  createSignedDownload(key: string, ttl: number): Promise<string> {
    return this.inner.createSignedDownload(key, ttl);
  }
}

describe("meter photo uploads", () => {
  test("CCCD upload rejects anonymous, cross-motel and invalid-side requests", async () => {
    const data = await seed();
    await db
      .update(managers)
      .set({ passwordHash: await Bun.password.hash("password", { algorithm: "argon2id" }) })
      .where(eq(managers.id, data.manager.id));
    const renter = (
      await db
        .insert(renters)
        .values({ motelId: data.motel.id, name: "CCCD renter", phone: "84922222222" })
        .returning()
    )[0]!;
    const multipart = () => {
      const body = new FormData();
      body.set(
        "file",
        new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "front.jpg", { type: "image/jpeg" }),
      );
      return body;
    };
    const anonymous = await app.handle(
      new Request(
        `http://localhost/api/manager/motels/${data.motel.id}/renters/${renter.id}/cccd/front`,
        { method: "POST", body: multipart() },
      ),
    );
    expect(anonymous.status).toBe(401);
    const foreign = await seed();
    const cookieResponse = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.manager.email, password: "password" }),
      }),
    );
    const cookie = cookieResponse.headers.get("set-cookie") ?? "";
    const crossMotel = await app.handle(
      new Request(
        `http://localhost/api/manager/motels/${foreign.motel.id}/renters/${renter.id}/cccd/front`,
        { method: "POST", headers: { Cookie: cookie }, body: multipart() },
      ),
    );
    expect(crossMotel.status).toBe(404);
    const crossMotelBody = (await crossMotel.json()) as { code: string };
    expect(crossMotelBody.code).toBe("NOT_FOUND");
    const badSide = await app.handle(
      new Request(
        `http://localhost/api/manager/motels/${data.motel.id}/renters/${renter.id}/cccd/sideways`,
        { method: "POST", headers: { Cookie: cookie }, body: multipart() },
      ),
    );
    expect([400, 422]).toContain(badSide.status);
  });

  test("CCCD routes accept multipart field `file` and expose only signed URL to managers", async () => {
    const data = await seed();
    await db
      .update(managers)
      .set({ passwordHash: await Bun.password.hash("password") })
      .where(eq(managers.id, data.manager.id));
    const loginResponse = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.manager.email, password: "password" }),
      }),
    );
    expect(loginResponse.status).toBe(200);
    const cookie = loginResponse.headers.get("set-cookie") ?? "";
    const body = new FormData();
    body.set(
      "file",
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "front.jpg", { type: "image/jpeg" }),
    );
    const uploaded = await app.handle(
      new Request(
        `http://localhost/api/manager/motels/${data.motel.id}/renters/${(await db.insert(renters).values({ motelId: data.motel.id, name: "CCCD renter", phone: "84922222222" }).returning())[0]!.id}/cccd/front`,
        { method: "POST", headers: { Cookie: cookie }, body },
      ),
    );
    expect(uploaded.status).toBe(201);
    const response = (await uploaded.json()) as Record<string, unknown>;
    expect(response).toMatchObject({
      side: "front",
      uploaded: true,
      contentType: "image/jpeg",
      size: 4,
    });
    expect(JSON.stringify(response)).not.toContain("objectKey");
  });

  test("stores private metadata and returns signed read", async () => {
    const data = await seed();
    const uploaded = await uploadMeterPhoto(
      data.motel.id,
      data.period.id,
      data.reading.id,
      data.manager.id,
      jpeg(),
    );
    expect(uploaded).toMatchObject({ contentType: "image/jpeg", size: 4 });
    expect("objectKey" in uploaded).toBe(false);
    const read = await getMeterPhoto(
      data.motel.id,
      data.period.id,
      data.reading.id,
      data.manager.id,
    );
    expect(read.url).toContain("fake://private/");
    expect("objectKey" in read).toBe(false);
  });

  test("CCCD R2 upload/read errors are sanitized and missing images are hidden", async () => {
    const data = await seed();
    await db
      .update(managers)
      .set({ passwordHash: await Bun.password.hash("password") })
      .where(eq(managers.id, data.manager.id));
    const renter = (
      await db
        .insert(renters)
        .values({ motelId: data.motel.id, name: "CCCD renter", phone: "84922222222" })
        .returning()
    )[0]!;
    const login = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.manager.email, password: "password" }),
      }),
    );
    const cookie = login.headers.get("set-cookie") ?? "";
    const missing = await app.handle(
      new Request(
        `http://localhost/api/manager/motels/${data.motel.id}/renters/${renter.id}/cccd/front`,
        { headers: { Cookie: cookie } },
      ),
    );
    expect(missing.status).toBe(404);
    configureCccdStorage(new FakeStorageAdapter({ failure: new Error("secret bucket token") }));
    const form = new FormData();
    form.set(
      "file",
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "front.jpg", { type: "image/jpeg" }),
    );
    const uploadFail = await app.handle(
      new Request(
        `http://localhost/api/manager/motels/${data.motel.id}/renters/${renter.id}/cccd/front`,
        { method: "POST", headers: { Cookie: cookie }, body: form },
      ),
    );
    expect(uploadFail.status).toBe(400);
    expect(await uploadFail.text()).not.toContain("secret bucket");
  });

  test("replaces prior photo and rejects sent periods", async () => {
    const data = await seed();
    const first = await uploadMeterPhoto(
      data.motel.id,
      data.period.id,
      data.reading.id,
      data.manager.id,
      jpeg(),
    );
    const second = await uploadMeterPhoto(
      data.motel.id,
      data.period.id,
      data.reading.id,
      data.manager.id,
      jpeg(),
    );
    expect(second.id).not.toBe(first.id);
    const sent = await seed("sent");
    await expect(
      uploadMeterPhoto(sent.motel.id, sent.period.id, sent.reading.id, sent.manager.id, jpeg()),
    ).rejects.toMatchObject({ code: "PERIOD_ALREADY_SENT" });
  });

  test("rejects bad magic bytes and oversized files before storage", async () => {
    const data = await seed();
    await expect(
      uploadMeterPhoto(
        data.motel.id,
        data.period.id,
        data.reading.id,
        data.manager.id,
        new File([new Uint8Array([1, 2, 3])], "bad.jpg", { type: "image/jpeg" }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      uploadMeterPhoto(
        data.motel.id,
        data.period.id,
        data.reading.id,
        data.manager.id,
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("cleans object when reading disappears after storage put", async () => {
    const data = await seed();
    let storedKey: string | undefined;
    const storage = new ObservableStorage(async () => {
      storedKey = (await db.query.uploads.findFirst())?.objectKey;
      await db.delete(meterReadings).where(eq(meterReadings.id, data.reading.id));
    });
    configureUploadStorage(storage);
    await expect(
      uploadMeterPhoto(data.motel.id, data.period.id, data.reading.id, data.manager.id, jpeg()),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(storage.deleted).toHaveLength(1);
    expect(storedKey).toBeUndefined();
    expect(storage.lastPutKey).toBeDefined();
    expect(await storage.exists(storage.lastPutKey as string)).toBe(false);
    expect(await db.query.uploads.findMany()).toHaveLength(0);
  });

  test("hides foreign reading and storage failures", async () => {
    const own = await seed();
    const other = await seed();
    await expect(
      uploadMeterPhoto(other.motel.id, own.period.id, own.reading.id, other.manager.id, jpeg()),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    configureUploadStorage(new FakeStorageAdapter({ failure: new Error("secret bucket") }));
    await expect(
      uploadMeterPhoto(own.motel.id, own.period.id, own.reading.id, own.manager.id, jpeg()),
    ).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });
});
