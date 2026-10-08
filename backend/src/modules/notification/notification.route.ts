import { Elysia, t } from "elysia";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/config";
import { db } from "@/db";
import { mapZaloFollowerByPhone, clearZaloFollower } from "@/modules/renter/renter.service";
import { notificationWebhookEvents } from "./notification.schema";
import { eq } from "drizzle-orm";
import { AppError } from "@/shared/errors";

function validSignature(raw: Uint8Array, signature: string | undefined): boolean { if (!signature) return false; const expected = createHmac("sha256", env.zalo.webhookSecret).update(raw).digest("hex"); const actual = Buffer.from(signature); const wanted = Buffer.from(expected); return actual.length === wanted.length && timingSafeEqual(actual, wanted); }

export const notificationRoutes = new Elysia({ name: "notification-routes" }).post("/zalo/webhook", async ({ request, headers, set }) => {
  const raw = new Uint8Array(await request.arrayBuffer());
  if (!validSignature(raw, headers["x-zalo-signature"])) { set.status = 401; return { error: "Chữ ký không hợp lệ", code: "UNAUTHORIZED" }; }
  let event: { event_id?: string; event_name?: string; user_id?: string; follower_id?: string; phone?: string; motel_id?: string };
  try { event = JSON.parse(new TextDecoder().decode(raw)) as typeof event; } catch { set.status = 400; return { error: "Dữ liệu webhook không hợp lệ", code: "VALIDATION_ERROR" }; }
  if (!event.event_name || !(event.user_id ?? event.follower_id)) { set.status = 400; return { error: "Dữ liệu webhook không hợp lệ", code: "VALIDATION_ERROR" }; }
  const eventId = event.event_id ?? createHmac("sha256", env.zalo.webhookSecret).update(raw).digest("hex");
  const [stored] = await db.insert(notificationWebhookEvents).values({ eventId, payload: event }).onConflictDoNothing({ target: notificationWebhookEvents.eventId }).returning();
  if (!stored) return { ok: true };
  const followerId = event.user_id ?? event.follower_id;
  if (followerId && event.event_name === "follow" && event.phone && event.motel_id) await mapZaloFollowerByPhone(event.phone, followerId);
  if (followerId && event.event_name === "unfollow") await clearZaloFollower(followerId);
  return { ok: true };
}, { parse: "none" });
