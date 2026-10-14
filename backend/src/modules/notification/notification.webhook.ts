import { db } from "@/db";
import { mapZaloFollowerByPhone, clearZaloFollower } from "@/modules/renter/renter.service";
import { notificationWebhookEvents, zaloOaMotelMappings } from "./notification.schema";
import { eq } from "drizzle-orm";

export async function processZaloWebhook(eventId: string, event: { event_name: string; user_id: string; phone?: string; oa_id?: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const [stored] = await tx.insert(notificationWebhookEvents).values({ eventId, payload: event }).onConflictDoNothing({ target: notificationWebhookEvents.eventId }).returning();
    if (!stored) return;
    if (event.event_name === "follow" && event.phone) {
      const [mapping] = await tx.select({ motelId: zaloOaMotelMappings.motelId }).from(zaloOaMotelMappings).where(eq(zaloOaMotelMappings.oaId, event.oa_id ?? ""));
      if (!mapping) throw new Error("follower mapping unavailable");
      await mapZaloFollowerByPhone(mapping.motelId, event.phone, event.user_id, tx);
    }
    if (event.event_name === "unfollow") await clearZaloFollower(event.user_id, tx);
  });
}
