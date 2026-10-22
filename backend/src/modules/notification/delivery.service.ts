import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { notificationEvents } from "./notification.schema";

let running = false;

export async function listDueNotificationIds(limit = 20): Promise<string[]> {
  const rows = await db.query.notificationEvents.findMany({ where: and(eq(notificationEvents.status, "pending"), or(isNull(notificationEvents.nextRetryAt), lte(notificationEvents.nextRetryAt, new Date())), or(isNull(notificationEvents.leaseUntil), lte(notificationEvents.leaseUntil, new Date()))), columns: { id: true }, orderBy: [notificationEvents.createdAt], limit: Math.max(1, Math.min(limit, 50)) });
  return rows.map((row) => row.id);
}

export async function runNotificationDeliveryOnce(deliver: (id: string) => Promise<unknown>, list: () => Promise<string[]> = () => listDueNotificationIds()): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const ids = await list();
    await Promise.all(ids.map(async (id) => { try { await deliver(id); } catch { } }));
    return ids.length;
  } finally {
    running = false;
  }
}

export async function notifyManualActionRequired(renterId: string, motelId: string, invoiceId: string, tx = db) {
  await tx.insert(notificationEvents).values({ eventKey: `invoice:${invoiceId}:manual-delivery-required`, renterId, motelId, channel: "manual", payload: { invoiceId } }).onConflictDoNothing({ target: notificationEvents.eventKey });
}
