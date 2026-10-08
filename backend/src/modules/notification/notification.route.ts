import { Elysia, t } from "elysia";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/config";
import { db } from "@/db";
import { renters } from "@/modules/renter/renter.schema";
import { and, eq } from "drizzle-orm";

function validSignature(body: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", env.zalo.webhookSecret).update(body).digest("hex");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export const notificationRoutes = new Elysia({ name: "notification-routes" }).post(
  "/zalo/webhook",
  async ({ request, headers, body, set }) => {
    const raw = JSON.stringify(body);
    if (!validSignature(raw, headers["x-zalo-signature"])) {
      set.status = 401;
      return { error: "Chữ ký không hợp lệ", code: "UNAUTHORIZED" };
    }
    const event = body as { event_name?: string; user_id?: string; follower_id?: string; phone?: string };
    const followerId = event.user_id ?? event.follower_id;
    if (!followerId) return { ok: true };
    const isFollow = event.event_name === "follow";
    const isUnfollow = event.event_name === "unfollow";
    if (isFollow || isUnfollow) {
      await db.update(renters).set({ zaloOaId: isFollow ? followerId : null, isOaFollower: isFollow }).where(and(eq(renters.phone, event.phone ?? ""), eq(renters.isOaFollower, isFollow ? false : true)));
    }
    return { ok: true };
  },
  { body: t.Record(t.String(), t.Unknown()) },
);
