import { and, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { getRenterForNotification } from "@/modules/renter/renter.service";
import { AppError } from "@/shared/errors";
import { notificationEvents } from "./notification.schema";
import type { NotificationEvent, NotificationInput, ZaloProvider } from "./notification.types";

const MAX_ATTEMPTS = 3;
let provider: ZaloProvider | undefined;
const secrets = new Map<string, Record<string, unknown>>();

export function setZaloProvider(next: ZaloProvider | undefined): void { provider = next; }
function redactPayload(payload: Record<string, unknown>) { return Object.fromEntries(Object.entries(payload).map(([key, value]) => [/otp|password|token|secret/i.test(key) ? [key, "[REDACTED]"] : [key, value]])); }
function failureKind(error: unknown): { transient: boolean; reason: string } { const kind = (error as { kind?: unknown }).kind; if (kind === "rate_limited" || kind === "provider_unavailable" || kind === "timeout") return { transient: true, reason: String(kind) }; if (kind === "invalid_recipient" || kind === "invalid_template" || kind === "unauthorized") return { transient: false, reason: String(kind) }; return { transient: (error as { transient?: unknown }).transient === true, reason: "provider_error" }; }

export async function enqueueNotification(input: NotificationInput): Promise<NotificationEvent> {
  const renter = await getRenterForNotification(input.renterId, input.motelId);
  if (!renter) throw AppError.notFound("Không tìm thấy người thuê");
  const channel = renter.isOaFollower && renter.zaloOaId ? "oa_message" : "zns";
  const [row] = await db.insert(notificationEvents).values({ eventKey: input.eventKey, renterId: input.renterId, motelId: input.motelId, channel, templateId: input.templateId, payload: redactPayload(input.payload) }).onConflictDoNothing({ target: notificationEvents.eventKey }).returning();
  if (row) { if (input.transientSecret) secrets.set(row.id, input.transientSecret); return row; }
  const existing = await db.query.notificationEvents.findFirst({ where: eq(notificationEvents.eventKey, input.eventKey) });
  if (!existing) throw new Error("Notification event was not created");
  return existing;
}

export async function deliverNotification(eventId: string): Promise<NotificationEvent> {
  if (!provider) throw AppError.externalService("Zalo chưa được cấu hình");
  const now = new Date();
  const [claimed] = await db.update(notificationEvents).set({ status: "pending", attemptCount: notificationEvents.attemptCount }).where(and(eq(notificationEvents.id, eventId), eq(notificationEvents.status, "pending"), or(isNull(notificationEvents.nextRetryAt), lte(notificationEvents.nextRetryAt, now)))).returning();
  const event = claimed ?? await db.query.notificationEvents.findFirst({ where: eq(notificationEvents.id, eventId) });
  if (!event) throw AppError.notFound("Không tìm thấy sự kiện thông báo");
  if (event.status === "sent" || event.status === "failed" || event.nextRetryAt && event.nextRetryAt > now) return event;
  const renter = await getRenterForNotification(event.renterId, event.motelId);
  if (!renter) throw AppError.notFound("Không tìm thấy người thuê");
  const payload = { ...event.payload, ...(secrets.get(event.id) ?? {}) };
  try {
    const result = event.channel === "oa_message" && renter.zaloOaId ? await provider.sendOaMessage({ recipientId: renter.zaloOaId, payload }) : await provider.sendZns({ phone: renter.phone, templateId: event.templateId ?? "", payload });
    secrets.delete(event.id);
    const [sent] = await db.update(notificationEvents).set({ status: "sent", providerId: result.providerId, sentAt: new Date(), updatedAt: new Date(), nextRetryAt: null, failureClass: null, failureReason: null }).where(and(eq(notificationEvents.id, event.id), eq(notificationEvents.status, "pending"))).returning();
    return sent ?? event;
  } catch (error) {
    const failure = failureKind(error); const attemptCount = event.attemptCount + 1; const exhausted = attemptCount >= MAX_ATTEMPTS || !failure.transient;
    const [failed] = await db.update(notificationEvents).set({ status: exhausted ? "failed" : "pending", attemptCount, failureClass: failure.transient ? "transient" : "permanent", failureReason: failure.reason, nextRetryAt: exhausted ? null : new Date(Date.now() + 2 ** attemptCount * 1000), updatedAt: new Date() }).where(and(eq(notificationEvents.id, event.id), eq(notificationEvents.status, "pending"))).returning();
    if (exhausted) secrets.delete(event.id);
    return failed ?? event;
  }
}
