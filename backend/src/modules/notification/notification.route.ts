import { Elysia, t } from "elysia";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/config";
import { AppError } from "@/shared/errors";
import { processZaloWebhook } from "./notification.webhook";

function validSignature(raw: Uint8Array, signature: string | undefined): boolean { if (!signature) return false; const expected = createHmac("sha256", env.zalo.webhookSecret).update(raw).digest("hex"); const actual = Buffer.from(signature); const wanted = Buffer.from(expected); return actual.length === wanted.length && timingSafeEqual(actual, wanted); }

export const notificationRoutes = new Elysia({ name: "notification-routes" }).post("/zalo/webhook", async ({ request, headers, set }) => {
  const raw = new Uint8Array(await request.arrayBuffer());
  if (!validSignature(raw, headers["x-zalo-signature"])) { set.status = 401; return { error: "Chữ ký không hợp lệ", code: "UNAUTHORIZED" }; }
  let event: { event_id?: string; event_name?: string; user_id?: string; follower_id?: string; phone?: string; motel_id?: string };
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid object");
    event = parsed as typeof event;
  } catch { set.status = 400; return { error: "Dữ liệu webhook không hợp lệ", code: "VALIDATION_ERROR" }; }
  if (!(typeof event.event_name === "string" && (event.event_name === "follow" || event.event_name === "unfollow"))) { set.status = 400; return { error: "Dữ liệu webhook không hợp lệ", code: "VALIDATION_ERROR" }; }
  const follower = event.user_id ?? event.follower_id;
  if (typeof follower !== "string" || follower.trim() === "") { set.status = 400; return { error: "Dữ liệu webhook không hợp lệ", code: "VALIDATION_ERROR" }; }
  if (event.event_name === "follow" && (typeof event.phone !== "string" || event.phone.trim() === "")) { set.status = 400; return { error: "Dữ liệu webhook không hợp lệ", code: "VALIDATION_ERROR" }; }
  const eventId = event.event_id ?? createHmac("sha256", env.zalo.webhookSecret).update(raw).digest("hex");
  const followerId = follower;
  try {
    await processZaloWebhook(eventId, { event_name: event.event_name, user_id: followerId, phone: event.phone });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw error;
  }
  return { ok: true };
}, { parse: "none" });
