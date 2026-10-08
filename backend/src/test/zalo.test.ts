import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHmac } from "node:crypto";
import { app } from "@/app";
import { env } from "@/config";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { zaloOaMotelMappings } from "@/modules/notification/notification.schema";

setDefaultTimeout(120_000);
beforeEach(resetDb);

async function fixture() {
  const [manager] = await db.insert(managers).values({ email: `${crypto.randomUUID()}@example.com`, passwordHash: "hash", name: "Manager" }).returning();
  const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "Nhà trọ", electricityPrice: "3500", waterPrice: "25000" }).returning();
  await db.insert(zaloOaMotelMappings).values({ oaId: "oa-1", motelId: motel!.id });
  const [renter] = await db.insert(renters).values({ motelId: motel!.id, name: "A", phone: "84912345678" }).returning();
  return { motel: motel!, renter: renter! };
}

async function webhook(body: unknown) {
  const raw = JSON.stringify(body);
  return app.handle(new Request("http://localhost/api/zalo/webhook", { method: "POST", headers: { "Content-Type": "application/json", "x-zalo-signature": createHmac("sha256", env.zalo.webhookSecret).update(raw).digest("hex") }, body: raw }));
}

describe("Zalo webhook", () => {
  test("rejects invalid signatures", async () => { const response = await app.handle(new Request("http://localhost/api/zalo/webhook", { method: "POST", headers: { "x-zalo-signature": "invalid" }, body: "{}" })); expect(response.status).toBe(401); });
  test("requires OA ID and phone for follow", async () => { await fixture(); expect((await webhook({ event_name: "follow", user_id: "u", phone: "84912345678" })).status).toBe(400); expect((await webhook({ event_name: "follow", user_id: "u", oa_id: "oa-1" })).status).toBe(400); });
  test("maps verified OA follow to renter and duplicate event is idempotent", async () => { const { renter } = await fixture(); const body = { event_id: "evt-1", event_name: "follow", user_id: "u", oa_id: "oa-1", phone: "84912345678" }; expect((await webhook(body)).status).toBe(200); expect((await webhook(body)).status).toBe(200); const row = await db.query.renters.findFirst({ where: eq(renters.id, renter.id) }); expect(row?.zaloOaId).toBe("u"); expect(row?.isOaFollower).toBe(true); });
  test("unfollow clears follower", async () => { const { renter } = await fixture(); await db.update(renters).set({ zaloOaId: "u", isOaFollower: true }).where(eq(renters.id, renter.id)); expect((await webhook({ event_name: "unfollow", user_id: "u", oa_id: "oa-1" })).status).toBe(200); const row = await db.query.renters.findFirst({ where: eq(renters.id, renter.id) }); expect(row?.isOaFollower).toBe(false); });
});
