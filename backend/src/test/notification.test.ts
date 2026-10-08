import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import {
  deliverNotification,
  enqueueNotification,
  setZaloProvider,
} from "@/modules/notification/notification.service";
import type { ZaloProvider } from "@/modules/notification/notification.types";

setDefaultTimeout(120_000);
beforeEach(async () => {
  await resetDb();
  setZaloProvider(undefined);
});

async function fixture() {
  const [manager] = await db.insert(managers).values({ email: `${crypto.randomUUID()}@example.com`, passwordHash: "hash", name: "Manager" }).returning();
  const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "Nhà trọ", electricityPrice: "3500", waterPrice: "25000" }).returning();
  const [renter] = await db.insert(renters).values({ motelId: motel!.id, name: "A", phone: "84912345678", zaloOaId: "oa-user" }).returning();
  return { motel: motel!, renter: renter! };
}

function provider(overrides: Partial<ZaloProvider> = {}): ZaloProvider {
  return {
    sendOaMessage: async () => ({ providerId: "oa-request" }),
    sendZns: async () => ({ providerId: "zns-request" }),
    ...overrides,
  };
}

describe("notification outbox", () => {
  test("deduplicates event keys and selects OA for followers", async () => {
    const { motel, renter } = await fixture();
    setZaloProvider(provider());
    const input = { eventKey: "invoice:one:sent", renterId: renter.id, motelId: motel.id, templateId: "bill", payload: { invoiceId: "one" } };
    const first = await enqueueNotification(input);
    const second = await enqueueNotification(input);
    expect(second.id).toBe(first.id);
    expect(first.channel).toBe("oa_message");
    expect(await deliverNotification(first.id)).toMatchObject({ status: "sent", providerId: "oa-request" });
  });

  test("uses ZNS when renter is not an OA follower and never stores OTP plaintext", async () => {
    const { motel, renter } = await fixture();
    await db.update(renters).set({ zaloOaId: null, isOaFollower: false }).where(eq(renters.id, renter.id));
    setZaloProvider(provider());
    const event = await enqueueNotification({ eventKey: "contract:one:otp", renterId: renter.id, motelId: motel.id, templateId: "otp", payload: { otp: "123456", contractId: "one" } });
    expect(event.channel).toBe("zns");
    expect(JSON.stringify(event.payload)).not.toContain("123456");
  });

  test("retries transient failures, then marks permanent failures without retry", async () => {
    const { motel, renter } = await fixture();
    let calls = 0;
    setZaloProvider(provider({ sendOaMessage: async () => { calls++; throw Object.assign(new Error("down"), { transient: true }); } }));
    const event = await enqueueNotification({ eventKey: "invoice:retry", renterId: renter.id, motelId: motel.id, payload: { invoiceId: "one" } });
    const failed = await deliverNotification(event.id);
    expect(failed).toMatchObject({ status: "pending", attemptCount: 1, failureClass: "transient" });
    expect(failed.nextRetryAt).toBeInstanceOf(Date);
    setZaloProvider(provider({ sendOaMessage: async () => { calls++; throw Object.assign(new Error("bad recipient"), { transient: false }); } }));
    const permanent = await deliverNotification(event.id);
    expect(permanent).toMatchObject({ status: "failed", attemptCount: 2, failureClass: "permanent" });
    expect(calls).toBe(2);
  });
});

import { eq } from "drizzle-orm";
