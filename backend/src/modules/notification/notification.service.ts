import { and, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
export type NotificationRecipient = { phone: string; zaloOaId: string | null; isOaFollower: boolean };
import { AppError } from "@/shared/errors";
import { notificationEvents } from "./notification.schema";
import type { NotificationEvent, NotificationInput, RetryFailureKind, ZaloProvider } from "./notification.types";

const MAX_ATTEMPTS = 3;
let provider: ZaloProvider | undefined;
const secrets = new Map<string, Record<string, unknown>>();
let recipientResolver: (renterId: string, motelId: string) => Promise<NotificationRecipient | undefined> = async () => undefined;
export function setNotificationRecipientResolver(resolver: (renterId: string, motelId: string) => Promise<NotificationRecipient | undefined>): void { recipientResolver = resolver; }

export function setZaloProvider(next: ZaloProvider | undefined): void { provider = next; }
function redactPayload(payload: Record<string, unknown>) { return Object.fromEntries(Object.entries(payload).map(([key, value]) => [/otp|password|token|secret/i.test(key) ? [key, "[REDACTED]"] : [key, value]])); }
function failureKind(error: unknown): { transient: boolean; reason: RetryFailureKind } { const kind = (error as { kind?: unknown }).kind; if (kind === "rate_limited" || kind === "provider_unavailable" || kind === "timeout") return { transient: true, reason: kind }; if (kind === "invalid_recipient" || kind === "invalid_template" || kind === "unauthorized") return { transient: false, reason: kind }; return { transient: false, reason: "provider_error" }; }

export async function enqueueNotification(input: NotificationInput): Promise<NotificationEvent> {
  if (!recipientResolver) throw AppError.externalService("Notification recipient resolver chưa được cấu hình");
  const recipient = await recipientResolver(input.renterId, input.motelId);
  if (!recipient) throw AppError.notFound("Không tìm thấy người thuê");
  const channel = recipient.isOaFollower && recipient.zaloOaId ? "oa_message" : "zns";
  const [row] = await db.insert(notificationEvents).values({ eventKey: input.eventKey, renterId: input.renterId, motelId: input.motelId, channel, templateId: input.templateId, payload: redactPayload(input.payload) }).onConflictDoNothing({ target: notificationEvents.eventKey }).returning();
  if (row) { if (input.transientSecret) secrets.set(row.id, input.transientSecret); return row; }
  const existing = await db.query.notificationEvents.findFirst({ where: eq(notificationEvents.eventKey, input.eventKey) });
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
  if (!recipientResolver) throw AppError.externalService("Notification recipient resolver chưa được cấu hình");
  const recipient = await recipientResolver(event.renterId, event.motelId);
  if (!recipient) throw AppError.notFound("Không tìm thấy người thuê");
  const transientSecret = secrets.get(event.id);
  if (Object.values(event.payload).some((value) => value === "[REDACTED]") && !transientSecret) {
    const [failedSecret] = await db.update(notificationEvents).set({ status: "failed", failureClass: "permanent", failureReason: "secret_unavailable", leaseId: null, leaseUntil: null, updatedAt: new Date() }).where(and(eq(notificationEvents.id, event.id), eq(notificationEvents.leaseId, leaseId))).returning();
    return failedSecret ?? event;
  }
  const payload = { ...event.payload, ...(transientSecret ?? {}) };
  try {
    const result = event.channel === "oa_message" && recipient.zaloOaId ? await provider.sendOaMessage({ recipientId: recipient.zaloOaId, payload }) : await provider.sendZns({ phone: recipient.phone, templateId: event.templateId ?? "", payload });
    secrets.delete(event.id);
    const [sent] = await db.update(notificationEvents).set({ status: "sent", providerId: result.providerId, sentAt: new Date(), updatedAt: new Date(), nextRetryAt: null, failureClass: null, failureReason: null, leaseId: null, leaseUntil: null }).where(and(eq(notificationEvents.id, event.id), eq(notificationEvents.leaseId, leaseId))).returning();
    return sent ?? event;
  } catch (error) {
    const failure = failureKind(error); const attemptCount = event.attemptCount + 1; const exhausted = attemptCount >= MAX_ATTEMPTS || !failure.transient;
    const [failed] = await db.update(notificationEvents).set({ status: exhausted ? "failed" : "pending", attemptCount, failureClass: failure.transient ? "transient" : "permanent", failureReason: failure.reason, nextRetryAt: exhausted ? null : new Date(Date.now() + 2 ** attemptCount * 1000), updatedAt: new Date() }).where(and(eq(notificationEvents.id, event.id), eq(notificationEvents.leaseId, leaseId))).returning();
    if (exhausted) secrets.delete(event.id);
    return failed ?? event;
  }
}
