import { randomInt } from "node:crypto";
import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { notificationEvents } from "@/modules/notification/notification.schema";
import {
  clearTransientNotificationSecrets,
  deliverNotification,
  enqueueNotification,
  getPushSubscriptionForOwner,
  getWebPushPublicKey,
  isWebPushConfigured,
  setWebPushConfiguration,
  removePushSubscription,
  savePushSubscription,
  sendPushToRenter,
  setNotificationRecipientResolver,
  setZaloProvider,
  configureWebPushClient,
  findPushSubscriptionsForRenter,
  validatePushEndpoint,
} from "@/modules/notification/notification.service";
import type { ZaloProvider } from "@/modules/notification/notification.types";

setDefaultTimeout(120_000);
beforeEach(async () => {
  await resetDb();
  clearTransientNotificationSecrets();
  setWebPushConfiguration(undefined);
  configureWebPushClient(undefined);
  setZaloProvider(undefined);
  setNotificationRecipientResolver(null);
});

async function fixture() {
  const [manager] = await db
    .insert(managers)
    .values({ email: `${crypto.randomUUID()}@example.com`, passwordHash: "hash", name: "Manager" })
    .returning();
  const [motel] = await db
    .insert(motels)
    .values({
      managerId: manager!.id,
      name: "Nhà trọ",
      electricityPrice: "3500",
      waterPrice: "25000",
    })
    .returning();
  const [renter] = await db
    .insert(renters)
    .values({ motelId: motel!.id, name: "A", phone: `84${randomInt(100_000_000, 1_000_000_000)}` })
    .returning();
  return { motel: motel!, renter: renter! };
}

function provider(overrides: Partial<ZaloProvider> = {}): ZaloProvider {
  return { sendZns: async () => ({ providerId: "zns-request" }), ...overrides };
}
function pushRuntime(
  overrides: { sendNotification?: (...args: unknown[]) => Promise<unknown> } = {},
) {
  const subscriptions: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }> = [];
  const deletions: string[] = [];
  const sendNotification = overrides.sendNotification ?? (async () => ({ ok: true }));
  setNotificationRecipientResolver(async () => ({ phone: "84901234567" }));
  return {
    subscriptions,
    deletions,
    sendNotification,
    client: {
      query: { pushSubscriptions: { findMany: async () => subscriptions } },
      delete: () => ({
        where: async (condition: unknown) => {
          deletions.push(String(condition));
        },
      }),
      __register: (endpoint: string, p256dh = "p256dh", auth = "auth") =>
        subscriptions.push({ endpoint, keys: { p256dh, auth } }),
    },
  };
}

describe("notification security and delivery", () => {
  test("push endpoint allowlist rejects malformed, untrusted and URL variation cases", () => {
    for (const endpoint of [
      "",
      "not-a-url",
      "http://fcm.googleapis.com/x",
      "https://user@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://fcm.googleapis.com/x#fragment",
      `https://fcm.googleapis.com/${"a".repeat(3000)}`,
      "https://evil.test/x",
    ])
      expect(() => validatePushEndpoint(endpoint)).toThrow();
    expect(validatePushEndpoint("https://fcm.googleapis.com/fcm/send/a?x=1")).toBe(
      "https://fcm.googleapis.com/fcm/send/a?x=1",
    );
  });

  test("returns false when client or subscription is missing", async () => {
    getWebPushPublicKey();
    if (!getWebPushPublicKey()) expect(isWebPushConfigured()).toBe(false);
    configureWebPushClient(undefined);
    expect(await sendPushToRenter("r", "m", { title: "Title", body: "Body" })).toBe(false);
    configureWebPushClient({
      setVapidDetails: () => {},
      sendNotification: async () => ({}),
    } as never);
    expect(await sendPushToRenter("r", "m", { title: "Title", body: "Body" })).toBe(false);
  });

  test("truncates push payloads, restricts paths, and deletes expired endpoints", async () => {
    const { renter, motel } = await fixture();
    setWebPushConfiguration({
      publicKey: "test-public",
      privateKey: "test-private",
      subject: "mailto:test@example.test",
    });
    configureWebPushClient({
      setVapidDetails: () => {},
      sendNotification: async (_sub: unknown, payload: string) => {
        const parsed = JSON.parse(payload);
        expect(parsed.title).toHaveLength(80);
        expect(parsed.body).toHaveLength(160);
        expect(parsed.path).toBe("/portal/bills");
        return {};
      },
    } as never);
    const endpoint = `https://fcm.googleapis.com/push/${crypto.randomUUID()}`;
    const save = await savePushSubscription(renter.id, motel.id, {
      endpoint,
      keys: { p256dh: "p", auth: "a" },
    });
    expect(save.registered).toBe(true);
    const captured = { title: "", body: "", path: "" };
    const { client } = pushRuntime();
    client.__register(endpoint);
    configureWebPushClient({
      setVapidDetails: () => {},
      sendNotification: async (_sub: unknown, payload: string) => {
        const parsed = JSON.parse(payload);
        captured.title = parsed.title;
        captured.body = parsed.body;
        captured.path = parsed.path;
        return {};
      },
    } as never);
    const sent = await sendPushToRenter(renter.id, motel.id, {
      title: "T".repeat(100),
      body: "B".repeat(200),
      path: "//evil.test/path",
    });
    expect(sent).toBe(true);
    expect(captured).toEqual({
      title: "T".repeat(80),
      body: "B".repeat(160),
      path: "/portal",
    });
    configureWebPushClient({
      setVapidDetails: () => {},
      sendNotification: async () => {
        throw Object.assign(new Error("expired"), { statusCode: 410 });
      },
    } as never);
    expect(await sendPushToRenter(renter.id, motel.id, { title: "Expired", body: "Body" })).toBe(
      false,
    );
    const remaining = await db.execute(
      sql`select endpoint from push_subscriptions where renter_id = ${renter.id} and motel_id = ${motel.id}`,
    );
    expect(remaining.map((row) => row.endpoint)).not.toContain(endpoint);
    expect(await findPushSubscriptionsForRenter(renter.id, motel.id)).toHaveLength(0);
  });
  test("rejects empty or over-limit subscription keys before writing", async () => {
    const { renter, motel } = await fixture();
    await expect(
      savePushSubscription(renter.id, motel.id, {
        endpoint: "https://fcm.googleapis.com/push/one",
        keys: { p256dh: "", auth: "auth" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      savePushSubscription(renter.id, motel.id, {
        endpoint: "x".repeat(4097),
        keys: { p256dh: "p256dh", auth: "auth" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(getPushSubscriptionForOwner(renter.id, motel.id)).resolves.toBeNull();
  });

  test("push endpoints require trusted HTTPS push services and reject unsafe destinations", async () => {
    const { renter, motel } = await fixture();
    const input = {
      endpoint: "https://fcm.googleapis.com/fcm/send/token",
      keys: { p256dh: "key-p256dh", auth: "key-auth" },
    };
    await savePushSubscription(renter.id, motel.id, input);
    expect(await getPushSubscriptionForOwner(renter.id, motel.id)).toEqual({
      endpoint: input.endpoint,
    });
    await expect(
      savePushSubscription(renter.id, motel.id, {
        ...input,
        endpoint: "https://127.0.0.1/private",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      removePushSubscription(renter.id, motel.id, "https://evil.example/push"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("subscription removal is scoped to the renter and motel session owner", async () => {
    const { renter, motel } = await fixture();
    const other = await fixture();
    const input = {
      endpoint: "https://updates.push.services.mozilla.com/wpush/v2/one",
      keys: { p256dh: "key-p256dh", auth: "key-auth" },
    };
    await savePushSubscription(renter.id, motel.id, input);
    await expect(
      savePushSubscription(other.renter.id, other.motel.id, input),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await removePushSubscription(other.renter.id, other.motel.id, input.endpoint);
    expect(await getPushSubscriptionForOwner(renter.id, motel.id)).toEqual({
      endpoint: input.endpoint,
    });
    await removePushSubscription(renter.id, motel.id, input.endpoint);
    expect(await getPushSubscriptionForOwner(renter.id, motel.id)).toBeNull();
  });
  test("recipient resolver absence and missing recipient fail without creating notification", async () => {
    const { motel, renter } = await fixture();
    await expect(
      enqueueNotification({
        eventKey: "no-resolver",
        renterId: renter.id,
        motelId: motel.id,
        payload: {},
      }),
    ).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
    setNotificationRecipientResolver(async () => undefined);
    await expect(
      enqueueNotification({
        eventKey: "missing-renter",
        renterId: renter.id,
        motelId: motel.id,
        payload: {},
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("duplicate notification key returns the existing event without replacing secret", async () => {
    const { motel, renter } = await fixture();
    setNotificationRecipientResolver(async () => ({ phone: renter.phone }));
    const first = await enqueueNotification({
      eventKey: "duplicate",
      renterId: renter.id,
      motelId: motel.id,
      payload: { message: "first" },
      transientSecret: { code: "123456" },
    });
    const duplicate = await enqueueNotification({
      eventKey: "duplicate",
      renterId: renter.id,
      motelId: motel.id,
      payload: { message: "second" },
      transientSecret: { code: "654321" },
    });
    expect(duplicate.id).toBe(first.id);
    expect(duplicate.payload).toEqual({ message: "first" });
  });

  test("returns existing non-pending event and rejects unknown event delivery", async () => {
    const { motel, renter } = await fixture();
    setNotificationRecipientResolver(async () => ({ phone: renter.phone }));
    const event = await enqueueNotification({
      eventKey: "sent-once",
      renterId: renter.id,
      motelId: motel.id,
      payload: {},
    });
    setZaloProvider(provider());
    const sent = await deliverNotification(event.id);
    expect(sent.status).toBe("sent");
    await expect(deliverNotification("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
  });

  test("notification redacts transient OTP payload, delivers using ZNS, and does not select OA based on follower state", async () => {
    const { motel, renter } = await fixture();
    let sent: Record<string, unknown> | undefined;
    setNotificationRecipientResolver(async () => ({ phone: renter.phone }));
    setZaloProvider(
      provider({
        sendZns: async ({ payload }) => {
          sent = payload;
          return { providerId: "zns-id" };
        },
      }),
    );
    const event = await enqueueNotification({
      eventKey: "otp:secret",
      renterId: renter.id,
      motelId: motel.id,
      payload: { otp: "123456" },
      transientSecret: { otp: "123456" },
    });
    expect((event.payload as Record<string, unknown>).otp).toBe("[REDACTED]");
    expect(event.channel).toBe("zns");
    await deliverNotification(event.id);
    expect(sent?.otp).toBe("123456");
  });

  test("rejects malformed subscription endpoint and unknown endpoint delete", async () => {
    const { renter, motel } = await fixture();
    expect(() => validatePushEndpoint("not-a-url")).toThrow();
    await expect(
      removePushSubscription(renter.id, motel.id, "https://evil.example/push"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("does not retry legacy OTP events after transient secret is lost", async () => {
    const { motel, renter } = await fixture();
    setNotificationRecipientResolver(async () => ({ phone: renter.phone }));
    setZaloProvider(provider({ sendZns: async () => ({ providerId: "id" }) }));
    const event = await enqueueNotification({
      eventKey: "otp:restart",
      renterId: renter.id,
      motelId: motel.id,
      payload: { code: "123456" },
      transientSecret: { code: "123456" },
    });
    clearTransientNotificationSecrets();
    setZaloProvider(
      provider({
        sendZns: async () => {
          throw new Error("must not send");
        },
      }),
    );
    const result = await deliverNotification(event.id);
    expect(result).toMatchObject({ status: "failed", failureReason: "secret_unavailable" });
  });

  test("clears lease before retry window so retry waits on nextRetryAt", async () => {
    const { motel, renter } = await fixture();
    setNotificationRecipientResolver(async () => ({ phone: renter.phone }));
    setZaloProvider(
      provider({
        sendZns: async () => {
          throw Object.assign(new Error("temporary"), { kind: "provider_unavailable" });
        },
      }),
    );
    const event = await enqueueNotification({
      eventKey: "retry-lease",
      renterId: renter.id,
      motelId: motel.id,
      payload: {},
    });
    const result = await deliverNotification(event.id);
    expect(result.status).toBe("pending");
    expect(result.leaseId).toBeNull();
    expect(result.leaseUntil).toBeNull();
    expect(result.nextRetryAt).not.toBeNull();
    await db
      .update(notificationEvents)
      .set({ nextRetryAt: new Date(Date.now() - 1_000) })
      .where(eq(notificationEvents.id, event.id));
    const claimedAgain = await deliverNotification(event.id);
    expect(claimedAgain.attemptCount).toBe(2);
  });

  test("classifies provider errors without persisting provider text", async () => {
    const { motel, renter } = await fixture();
    setNotificationRecipientResolver(async () => ({ phone: renter.phone }));
    setZaloProvider(
      provider({
        sendZns: async () => {
          throw Object.assign(new Error("token=secret"), { kind: "invalid_recipient" });
        },
      }),
    );
    const event = await enqueueNotification({
      eventKey: "invalid",
      renterId: renter.id,
      motelId: motel.id,
      payload: {},
    });
    const result = await deliverNotification(event.id);
    expect(result).toMatchObject({
      status: "failed",
      failureClass: "permanent",
      failureReason: "invalid_recipient",
    });
    expect(result.failureReason).not.toContain("secret");
  });
});
