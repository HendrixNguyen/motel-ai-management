import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { deliverNotification, enqueueNotification, setZaloProvider } from "@/modules/notification/notification.service";
import type { ZaloProvider } from "@/modules/notification/notification.types";

setDefaultTimeout(120_000);
beforeEach(async () => { await resetDb(); setZaloProvider(undefined); });

async function fixture() {
  const [manager] = await db.insert(managers).values({ email: `${crypto.randomUUID()}@example.com`, passwordHash: "hash", name: "Manager" }).returning();
  const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "Nhà trọ", electricityPrice: "3500", waterPrice: "25000" }).returning();
  const [renter] = await db.insert(renters).values({ motelId: motel!.id, name: "A", phone: "84912345678", zaloOaId: "oa-user", isOaFollower: true }).returning();
  return { motel: motel!, renter: renter! };
}

function provider(overrides: Partial<ZaloProvider> = {}): ZaloProvider { return { sendOaMessage: async () => ({ providerId: "oa-request" }), sendZns: async () => ({ providerId: "zns-request" }), ...overrides }; }

describe("notification security and delivery", () => {
  test("delivers transient OTP secret while storing only redacted audit payload", async () => {
    const { motel, renter } = await fixture();
    let sent: Record<string, unknown> | undefined;
    setZaloProvider(provider({ sendOaMessage: async ({ payload }) => { sent = payload; return { providerId: "id" }; } }));
    const event = await enqueueNotification({ eventKey: "otp:secret", renterId: renter.id, motelId: motel.id, payload: { otp: "123456" }, transientSecret: { otp: "123456" } });
    expect(event.payload.otp).toBe("[REDACTED]");
    await deliverNotification(event.id);
    expect(sent?.otp).toBe("123456");
  });

  test("does not retry OTP after process restart loses transient secret", async () => {
    const { motel, renter } = await fixture();
    setZaloProvider(provider({ sendOaMessage: async () => ({ providerId: "id" }) }));
    const event = await enqueueNotification({ eventKey: "otp:restart", renterId: renter.id, motelId: motel.id, payload: { otp: "[REDACTED]" }, transientSecret: { otp: "123456" } });
    setZaloProvider(provider({ sendOaMessage: async () => { throw new Error("must not send"); } }));
    const result = await deliverNotification(event.id);
    expect(result).toMatchObject({ status: "failed", failureReason: "secret_unavailable" });
  });

  test("classifies provider errors without persisting provider text", async () => {
    const { motel, renter } = await fixture();
    setZaloProvider(provider({ sendOaMessage: async () => { throw Object.assign(new Error("token=secret"), { kind: "invalid_recipient" }); } }));
    const event = await enqueueNotification({ eventKey: "invalid", renterId: renter.id, motelId: motel.id, payload: {} });
    const result = await deliverNotification(event.id);
    expect(result).toMatchObject({ status: "failed", failureClass: "permanent", failureReason: "invalid_recipient" });
    expect(result.failureReason).not.toContain("secret");
  });
});
