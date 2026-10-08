import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { renters } from "@/modules/renter/renter.schema";
import { AppError } from "@/shared/errors";
import { notificationEvents } from "./notification.schema";
import type { NotificationEvent, NotificationInput, ZaloProvider } from "./notification.types";

const MAX_ATTEMPTS = 3;
let provider: ZaloProvider | undefined;

export function setZaloProvider(next: ZaloProvider | undefined): void {
  provider = next;
}

function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [
    /otp|password|token|secret/i.test(key) ? key : key,
    /otp|password|token|secret/i.test(key) ? "[REDACTED]" : value,
  ]));
}

export async function enqueueNotification(input: NotificationInput): Promise<NotificationEvent> {
  const renter = await db.query.renters.findFirst({ where: and(eq(renters.id, input.renterId), eq(renters.motelId, input.motelId)) });
  if (!renter) throw AppError.notFound("Không tìm thấy người thuê");
  const channel = renter.isOaFollower && renter.zaloOaId ? "oa_message" : "zns";
  const payload = redactPayload(input.payload);
  const [row] = await db.insert(notificationEvents).values({ ...input, channel, payload }).onConflictDoNothing({ target: notificationEvents.eventKey }).returning();
  if (row) return row;
  const existing = await db.query.notificationEvents.findFirst({ where: eq(notificationEvents.eventKey, input.eventKey) });
  if (!existing) throw new Error("Notification event was not created");
  return existing;
}

export async function deliverNotification(eventId: string): Promise<NotificationEvent> {
  if (!provider) throw AppError.externalService("Zalo chưa được cấu hình");
  const event = await db.query.notificationEvents.findFirst({ where: eq(notificationEvents.id, eventId) });
  if (!event) throw AppError.notFound("Không tìm thấy sự kiện thông báo");
  if (event.status === "sent" || event.status === "failed") return event;
  const renter = await db.query.renters.findFirst({ where: eq(renters.id, event.renterId) });
  if (!renter) throw AppError.notFound("Không tìm thấy người thuê");
  try {
    const result = event.channel === "oa_message"
      ? await provider.sendOaMessage({ recipientId: renter.zaloOaId!, payload: event.payload })
      : await provider.sendZns({ phone: renter.phone, templateId: event.templateId ?? "", payload: event.payload });
    const [sent] = await db.update(notificationEvents).set({ status: "sent", providerId: result.providerId, sentAt: new Date(), updatedAt: new Date(), failureClass: null, failureReason: null }).where(eq(notificationEvents.id, event.id)).returning();
    return sent!;
  } catch (error) {
    const transient = (error as { transient?: unknown }).transient === true;
    const attemptCount = event.attemptCount + 1;
    const exhausted = attemptCount >= MAX_ATTEMPTS || !transient;
    const [failed] = await db.update(notificationEvents).set({ status: exhausted ? "failed" : "pending", attemptCount, failureClass: transient ? "transient" : "permanent", failureReason: error instanceof Error ? error.message : "provider failure", nextRetryAt: exhausted ? null : new Date(Date.now() + 2 ** attemptCount * 1000), updatedAt: new Date() }).where(eq(notificationEvents.id, event.id)).returning();
    return failed!;
  }
}
