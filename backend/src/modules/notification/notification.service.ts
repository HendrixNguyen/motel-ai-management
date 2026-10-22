import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { createRequire } from "node:module";
import type webPush from "web-push";
import { env } from "@/config";
import { db } from "@/db";
import { AppError } from "@/shared/errors";
import { notificationEvents, pushSubscriptions } from "./notification.schema";
export type NotificationRecipient = { phone: string };
import type { NotificationEvent, NotificationInput, RetryFailureKind, ZaloProvider } from "./notification.types";
import type { Db } from "@/db";

const MAX_ATTEMPTS = 3;
const require = createRequire(import.meta.url);
let webPushClient: typeof webPush | undefined;
try { webPushClient = require("web-push") as typeof webPush; } catch { }
let provider: ZaloProvider | undefined;
const secrets = new Map<string, Record<string, unknown>>();
let webPushTestConfig: { publicKey: string; privateKey: string; subject: string } | undefined;
export function setWebPushConfiguration(config: { publicKey: string; privateKey: string; subject: string } | undefined): void { webPushTestConfig = config; }
const secretsAvailableAtEnqueue = new Set<string>();
let recipientResolver: ((renterId: string, motelId: string) => Promise<NotificationRecipient | undefined>) | undefined;
export async function getRenterNotificationRecipient(renterId: string, motelId: string): Promise<NotificationRecipient | undefined> {
  if (!recipientResolver) return undefined;
  return recipientResolver(renterId, motelId);
}

export function setNotificationRecipientResolver(resolver: ((renterId: string, motelId: string) => Promise<NotificationRecipient | undefined>) | null): void { recipientResolver = resolver ?? undefined; }
export function resetNotificationRecipientResolver(): void { recipientResolver = undefined; }
export function clearTransientNotificationSecrets(): void { secrets.clear(); secretsAvailableAtEnqueue.clear(); }

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };
const PUSH_ENDPOINT_ALLOWLIST = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
export function validatePushEndpoint(raw: string): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw AppError.badRequest("Địa chỉ thông báo không hợp lệ"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !PUSH_ENDPOINT_ALLOWLIST.has(url.hostname) || url.hash || url.search.length > 2048 || url.pathname.length > 2048) throw AppError.badRequest("Nhà cung cấp thông báo không được hỗ trợ");
  return url.toString();
}

export async function sendPushToRenter(renterId: string, motelId: string, payload: { title: string; body: string; path?: string; tag?: string }): Promise<boolean> {
  const webPushConfig = webPushTestConfig ?? env.webPush;
  if (!webPushConfig) return false;
  const subscriptions = await findPushSubscriptionsForRenter(renterId, motelId);
  if (!subscriptions.length) return false;
  const webPush = webPushClient;
  if (!webPush) return false;
  try { webPush.setVapidDetails(webPushConfig.subject, webPushConfig.publicKey, webPushConfig.privateKey); } catch { return false; }
  const data = JSON.stringify({ title: payload.title.slice(0, 80), body: payload.body.slice(0, 160), path: payload.path?.startsWith("/portal/bills/") ? payload.path : "/portal/bills", tag: payload.tag?.slice(0, 100) });
  const results = await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, data, { TTL: 3600 });
      return true;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
      return false;
    }
  }));
  return results.some(Boolean);
}

export async function getPushSubscriptionForOwner(renterId: string, motelId: string) {
  const row = await db.query.pushSubscriptions.findFirst({ where: and(eq(pushSubscriptions.renterId, renterId), eq(pushSubscriptions.motelId, motelId)), columns: { endpoint: true } });
  return row ?? null;
}

export async function savePushSubscription(renterId: string, motelId: string, input: PushSubscriptionInput) {
  if (input.endpoint.length > 4096 || input.keys.p256dh.length > 256 || input.keys.auth.length > 256 || !input.keys.p256dh.trim() || !input.keys.auth.trim()) throw AppError.badRequest("Thông tin thông báo không hợp lệ");
  const endpoint = validatePushEndpoint(input.endpoint);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${endpoint}, 0))`);
    const [existing] = await tx.execute(sql`select renter_id, motel_id from push_subscriptions where endpoint = ${endpoint} for update`);
    if (existing && (existing.renter_id !== renterId || existing.motel_id !== motelId)) throw AppError.conflict("Thiết bị thông báo đang liên kết với hồ sơ khác");
    const [row] = await tx.insert(pushSubscriptions).values({ renterId, motelId, endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth }).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh: input.keys.p256dh, auth: input.keys.auth, updatedAt: new Date() } }).returning({ id: pushSubscriptions.id });
    return { registered: true, subscriptionId: row!.id };
  });
}

export async function removePushSubscription(renterId: string, motelId: string, rawEndpoint: string) {
  const endpoint = validatePushEndpoint(rawEndpoint);
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.renterId, renterId), eq(pushSubscriptions.motelId, motelId), eq(pushSubscriptions.endpoint, endpoint)));
  return { removed: true };
}

export function configureWebPushClient(client: typeof webPush | undefined): void { webPushClient = client; }

export async function findPushSubscriptionsForRenter(renterId: string, motelId: string) {
  return db.query.pushSubscriptions.findMany({ where: and(eq(pushSubscriptions.renterId, renterId), eq(pushSubscriptions.motelId, motelId)) });
}

export async function removePushSubscriptionsForRenter(renterId: string, motelId: string): Promise<void> {
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.renterId, renterId), eq(pushSubscriptions.motelId, motelId)));
}

export async function movePushSubscriptionsBetweenRenters(sourceRenterId: string, sourceMotelId: string, targetRenterId: string, targetMotelId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const subscriptions = await tx.query.pushSubscriptions.findMany({ where: and(eq(pushSubscriptions.renterId, sourceRenterId), eq(pushSubscriptions.motelId, sourceMotelId)) });
    for (const subscription of subscriptions) {
      await tx.insert(pushSubscriptions).values({ renterId: targetRenterId, motelId: targetMotelId, endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth }).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { renterId: targetRenterId, motelId: targetMotelId, p256dh: subscription.p256dh, auth: subscription.auth, updatedAt: new Date() } });
    }
    await tx.delete(pushSubscriptions).where(and(eq(pushSubscriptions.renterId, sourceRenterId), eq(pushSubscriptions.motelId, sourceMotelId)));
  });
}

export function getWebPushPublicKey(): string | null { return webPushTestConfig?.publicKey ?? env.webPush?.publicKey ?? null; }
export function isWebPushConfigured(): boolean { return Boolean((webPushTestConfig ?? env.webPush) && webPushClient); }

export function setZaloProvider(next: ZaloProvider | undefined): void { provider = next; }
function redactPayload(payload: Record<string, unknown>) { return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, /otp|password|token|secret|code/i.test(key) ? "[REDACTED]" : value])); }
function failureKind(error: unknown): { transient: boolean; reason: RetryFailureKind } { const kind = (error as { kind?: unknown }).kind; if (kind === "rate_limited" || kind === "provider_unavailable" || kind === "timeout") return { transient: true, reason: kind }; if (kind === "invalid_recipient" || kind === "invalid_template" || kind === "unauthorized") return { transient: false, reason: kind }; return { transient: false, reason: "provider_error" }; }

type NotificationExecutor = Pick<Db, "insert" | "query">;

export async function enqueueNotification(input: NotificationInput, executor: NotificationExecutor = db): Promise<NotificationEvent> {
  if (!recipientResolver) throw AppError.externalService("Notification recipient resolver chưa được cấu hình");
  const recipient = await recipientResolver(input.renterId, input.motelId);
  if (!recipient) throw AppError.notFound("Không tìm thấy người thuê");
  const channel = "zns" as const;
  const [row] = await executor.insert(notificationEvents).values({ eventKey: input.eventKey, renterId: input.renterId, motelId: input.motelId, channel, templateId: input.templateId, payload: redactPayload(input.payload) }).onConflictDoNothing({ target: notificationEvents.eventKey }).returning();
  if (row) { if (input.transientSecret) { secrets.set(row.id, input.transientSecret); secretsAvailableAtEnqueue.add(row.id); } return row; }
  const existing = await executor.query.notificationEvents.findFirst({ where: eq(notificationEvents.eventKey, input.eventKey) });
  if (!existing) throw new Error("Notification event was not created");
  return existing;
}

export async function deliverNotification(eventId: string): Promise<NotificationEvent> {
  if (!provider) throw AppError.externalService("Zalo chưa được cấu hình");
  const now = new Date();
  const leaseId = crypto.randomUUID();
  const [claimed] = await db.update(notificationEvents).set({ leaseId, leaseUntil: new Date(Date.now() + 30_000), updatedAt: now }).where(and(eq(notificationEvents.id, eventId), eq(notificationEvents.status, "pending"), or(isNull(notificationEvents.nextRetryAt), lte(notificationEvents.nextRetryAt, now)), or(isNull(notificationEvents.leaseUntil), lte(notificationEvents.leaseUntil, now)))).returning();
  if (!claimed) {
    const event = await db.query.notificationEvents.findFirst({ where: eq(notificationEvents.id, eventId) });
    if (!event) throw AppError.notFound("Không tìm thấy sự kiện thông báo");
    return event;
  }
  const event = claimed;
  const releaseLease = async (): Promise<boolean> => Boolean((await db.update(notificationEvents).set({ leaseId: null, leaseUntil: null, updatedAt: new Date() }).where(and(eq(notificationEvents.id, event.id), eq(notificationEvents.leaseId, leaseId))).returning())[0]);
  if (!recipientResolver) {
    await releaseLease();
    throw AppError.externalService("Notification recipient resolver chưa được cấu hình");
  }
  let recipient: NotificationRecipient | undefined;
  try {
    recipient = await recipientResolver(event.renterId, event.motelId);
  } catch (error) {
    await releaseLease();
    throw error;
  }
  if (!recipient) {
    const released = await releaseLease();
    throw AppError.notFound(released ? "Không tìm thấy người thuê" : "Không tìm thấy sự kiện thông báo");
  }
  const transientSecret = secrets.get(event.id);
  if (Object.entries(event.payload).some(([key, value]) => value === "[REDACTED]" && /otp|password|token|secret|code/i.test(key)) && !secretsAvailableAtEnqueue.has(event.id)) {
    const [failedSecret] = await db.update(notificationEvents).set({ status: "failed", failureClass: "permanent", failureReason: "secret_unavailable", leaseId: null, leaseUntil: null, updatedAt: new Date() }).where(and(eq(notificationEvents.id, event.id), eq(notificationEvents.leaseId, leaseId))).returning();
    return failedSecret ?? event;
  }
  const payload = { ...event.payload, ...(transientSecret ?? {}) };
  try {
    const result = await provider.sendZns({ phone: recipient.phone, templateId: event.templateId ?? "", payload });
    secrets.delete(event.id); secretsAvailableAtEnqueue.delete(event.id);
    const [sent] = await db.update(notificationEvents).set({ status: "sent", providerId: result.providerId, sentAt: new Date(), updatedAt: new Date(), nextRetryAt: null, failureClass: null, failureReason: null, leaseId: null, leaseUntil: null }).where(and(eq(notificationEvents.id, event.id), eq(notificationEvents.leaseId, leaseId))).returning();
    return sent ?? event;
  } catch (error) {
    const failure = failureKind(error); const attemptCount = event.attemptCount + 1; const exhausted = attemptCount >= MAX_ATTEMPTS || !failure.transient;
    const [failed] = await db.update(notificationEvents).set({ status: exhausted ? "failed" : "pending", attemptCount, failureClass: failure.transient ? "transient" : "permanent", failureReason: failure.reason, nextRetryAt: exhausted ? null : new Date(Date.now() + 2 ** attemptCount * 1000), leaseId: null, leaseUntil: null, updatedAt: new Date() }).where(and(eq(notificationEvents.id, event.id), eq(notificationEvents.leaseId, leaseId))).returning();
    if (exhausted) { secrets.delete(event.id); secretsAvailableAtEnqueue.delete(event.id); }
    return failed ?? event;
  }
}
