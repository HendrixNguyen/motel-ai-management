import { db } from "@/db";
import { clearZaloFollower } from "@/modules/renter/renter.service";
import { notificationWebhookEvents } from "./notification.schema";

export async function processZaloWebhook(
  eventId: string,
  event: { event_name: string; user_id: string; phone?: string; oa_id?: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [stored] = await tx
      .insert(notificationWebhookEvents)
      .values({ eventId, payload: event })
      .onConflictDoNothing({ target: notificationWebhookEvents.eventId })
      .returning();
    if (!stored) return;
    if (event.event_name === "unfollow") await clearZaloFollower(event.user_id, tx);
  });
}
