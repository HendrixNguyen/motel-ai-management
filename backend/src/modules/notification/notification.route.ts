import { Elysia, t } from "elysia";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/config";
import { AppError } from "@/shared/errors";
import { processZaloWebhook } from "./notification.webhook";
import { renterAuth } from "@/middleware/renter-auth";
import {
  getPushSubscriptionForOwner,
  getWebPushPublicKey,
  isWebPushConfigured,
  removePushSubscription,
  savePushSubscription,
} from "./notification.service";

function validSignature(
  raw: Uint8Array,
  signature: string | undefined,
  webhookSecret: string,
): boolean {
  if (!webhookSecret || !signature) return false;
  const expected = createHmac("sha256", webhookSecret).update(raw).digest("hex");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

const pushBody = t.Object({
  endpoint: t.String({ minLength: 1, maxLength: 4096 }),
  expirationTime: t.Optional(t.Nullable(t.Number())),
  keys: t.Object({
    p256dh: t.String({ minLength: 1, maxLength: 256 }),
    auth: t.String({ minLength: 1, maxLength: 256 }),
  }),
});
const pushDeleteBody = t.Object({ endpoint: t.String({ minLength: 1, maxLength: 4096 }) });
export const notificationRoutes = new Elysia({ name: "notification-routes" })
  .group("/renter/push", (app) =>
    app
      .use(renterAuth)
      .get("/key", () => ({ publicKey: getWebPushPublicKey(), enabled: isWebPushConfigured() }), {
        detail: { security: [{ renterAuth: [] }] },
      })
      .get(
        "/subscription",
        async ({ auth }) => ({
          subscription: await getPushSubscriptionForOwner(auth!.renterId, auth!.motelId),
        }),
        { detail: { security: [{ renterAuth: [] }] } },
      )
      .post(
        "/subscription",
        ({ auth, body }) => savePushSubscription(auth!.renterId, auth!.motelId, body),
        { body: pushBody, detail: { security: [{ renterAuth: [] }] } },
      )
      .delete(
        "/subscription",
        ({ auth, body }) => removePushSubscription(auth!.renterId, auth!.motelId, body.endpoint),
        { body: pushDeleteBody, detail: { security: [{ renterAuth: [] }] } },
      ),
  )
  .post(
    "/webhooks/zalo",
    async ({ request, headers, set }) => {
      if (!env.zalo.enabled) {
        set.status = 404;
        return { error: "Không tìm thấy", code: "NOT_FOUND" };
      }
      const raw = new Uint8Array(await request.arrayBuffer());
      if (!validSignature(raw, headers["x-zalo-signature"], env.zalo.webhookSecret)) {
        set.status = 401;
        return { error: "Chữ ký không hợp lệ", code: "UNAUTHORIZED" };
      }
      let event: {
        event_id?: string;
        event_name?: string;
        user_id?: string;
        follower_id?: string;
        phone?: string;
        oa_id?: string;
      };
      try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(raw));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error("invalid object");
        event = parsed as typeof event;
      } catch {
        set.status = 400;
        return { error: "Dữ liệu webhook không hợp lệ", code: "VALIDATION_ERROR" };
      }
      if (typeof event.event_name !== "string") {
        set.status = 400;
        return { error: "Dữ liệu webhook không hợp lệ", code: "VALIDATION_ERROR" };
      }
      if (event.event_name !== "follow" && event.event_name !== "unfollow") return { ok: true };
      const follower = event.user_id ?? event.follower_id;
      if (typeof follower !== "string" || follower.trim() === "") {
        set.status = 400;
        return { error: "Dữ liệu webhook không hợp lệ", code: "VALIDATION_ERROR" };
      }
      if (
        event.event_name === "follow" &&
        (typeof event.phone !== "string" || event.phone.trim() === "")
      ) {
        set.status = 400;
        return { error: "Dữ liệu webhook không hợp lệ", code: "VALIDATION_ERROR" };
      }
      if (
        event.event_id !== undefined &&
        (typeof event.event_id !== "string" || event.event_id.trim() === "")
      ) {
        set.status = 400;
        return { error: "Dữ liệu webhook không hợp lệ", code: "VALIDATION_ERROR" };
      }
      if (
        event.event_name === "follow" &&
        (typeof event.oa_id !== "string" || event.oa_id.trim() === "")
      ) {
        set.status = 400;
        return { error: "Dữ liệu webhook không hợp lệ", code: "VALIDATION_ERROR" };
      }
      const eventId = event.event_id?.trim() ?? createHmac("sha256", env.zalo.webhookSecret).update(raw).digest("hex");
      const followerId = follower;
      try {
        await processZaloWebhook(eventId, {
          event_name: event.event_name,
          user_id: followerId,
          phone: event.phone,
          oa_id: event.oa_id,
        });
      } catch (error) {
        if (error instanceof AppError) throw error;
        set.status = 500;
        return { error: "Webhook chưa thể xử lý", code: "INTERNAL_ERROR" };
      }
      return { ok: true };
    },
    { parse: "none" },
  );
