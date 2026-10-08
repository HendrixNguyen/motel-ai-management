import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { renters } from "@/modules/renter/renter.schema";

export type NotificationRecipient = Pick<typeof renters.$inferSelect, "phone" | "zaloOaId" | "isOaFollower">;

export async function getNotificationRecipient(renterId: string, motelId: string): Promise<NotificationRecipient | undefined> {
  const rows = await db.select({ phone: renters.phone, zaloOaId: renters.zaloOaId, isOaFollower: renters.isOaFollower }).from(renters).where(and(eq(renters.id, renterId), eq(renters.motelId, motelId))).limit(1);
  return rows[0];
}
