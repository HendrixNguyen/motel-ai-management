import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { jwt } from "@elysiajs/jwt";
import { env } from "@/config";
import { renterAuth } from "@/middleware/renter-auth";
import { consumeMagicLink, issueMagicLink } from "@/shared/magic-link";
import { AppError } from "@/shared/errors";
import { removePushSubscriptionsForRenter } from "@/modules/notification/notification.service";
import { enforceRateLimit } from "@/shared/rate-limit";
import { requestRenterLogin } from "./renter-login-request.service";

const COOKIE_NAME = "renter_session";

function clientKey(request: Request): string {
  return env.trustedProxyHeader &&
    env.trustedProxyAssertionHeader &&
    env.trustedProxyAssertionValue &&
    request.headers.get(env.trustedProxyAssertionHeader) === env.trustedProxyAssertionValue
    ? request.headers.get(env.trustedProxyHeader)?.split(",")[0]?.trim() || "unknown"
    : "unknown";
}

export const magicLinkRoutes = new Elysia({ name: "magic-link-routes" })
  .post("/renter/login-requests", async ({ body, request }) => requestRenterLogin(body.motelCode, body.phone, clientKey(request)), { body: t.Object({ motelCode: t.String({ minLength: 20, maxLength: 128 }), phone: t.String({ minLength: 8, maxLength: 16 }) }) })
  .use(cookie())
  .use(jwt({ name: "renterJwt", secret: env.renterSessionSecret, exp: "24h" }))
  .post(
    "/renter/magic-links/exchange",
    async ({ body, renterJwt, cookie, set, request }) => {
      const ip = clientKey(request);
      await enforceRateLimit(`magic-exchange:ip:${ip}`, 10);
      await enforceRateLimit(`magic-exchange:token:${body.token}`, 3);

      const renter = await consumeMagicLink(body.token);
      if (renter.status !== "active") {
        set.status = 401;
        return { error: "Chưa đăng nhập", code: "UNAUTHORIZED" };
      }
      const token = await renterJwt.sign({ renterId: renter.id, motelId: renter.motelId });
      cookie[COOKIE_NAME]?.set({
        value: token,
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
        path: "/",
      });
      return { renterId: renter.id, motelId: renter.motelId };
    },
    {
      body: t.Object({ token: t.String() }),
    },
  )
  .use(renterAuth)
  .post(
    "/renter/logout",
    async ({ cookie, set, auth }) => {
      await removePushSubscriptionsForRenter(auth!.renterId, auth!.motelId);
      cookie[COOKIE_NAME]?.remove();
      set.status = 204;
      return "";
    },
    { detail: { security: [{ renterAuth: [] }] } },
  )
  .group("/renter/magic-links", (app) =>
    app.use(renterAuth).post(
      "/resend",
      async ({ auth, set, request }) => {
        const ip = clientKey(request);
        await enforceRateLimit(`magic-resend:ip:${ip}`, 5);
        await enforceRateLimit(`magic-resend:renter:${auth!.renterId}`, 3);
        const { token, url } = await issueMagicLink(auth!.renterId);
        set.status = 200;
        return { message: "Đã gửi lại liên kết đăng nhập", url };
      },
      {
        detail: { security: [{ renterAuth: [] }] },
      },
    ),
  );
