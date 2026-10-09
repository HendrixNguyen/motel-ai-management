import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { jwt } from "@elysiajs/jwt";
import { env } from "@/config";
import { renterAuth } from "@/middleware/renter-auth";
import { consumeMagicLink, issueMagicLink } from "@/shared/magic-link";
import { AppError } from "@/shared/errors";
import { enforceRateLimit } from "@/shared/rate-limit";

const COOKIE_NAME = "renter_session";

export const magicLinkRoutes = new Elysia({ name: "magic-link-routes" })
  .use(cookie())
  .use(jwt({ name: "renterJwt", secret: env.renterSessionSecret, exp: "24h" }))
  .post(
    "/renter/magic-links/exchange",
    async ({ body, renterJwt, cookie, set, request }) => {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      enforceRateLimit(`magic-exchange:ip:${ip}`, 10);
      enforceRateLimit(`magic-exchange:token:${body.token}`, 3);
      const renter = await consumeMagicLink(body.token);
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
  .post("/renter/logout", ({ cookie, set }) => { cookie[COOKIE_NAME]?.remove(); set.status = 204; return ""; }, { detail: { security: [{ renterAuth: [] }] } })
  .group("/renter/magic-links", (app) =>
    app.use(renterAuth).post(
      "/resend",
      async ({ auth, set, request }) => {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        enforceRateLimit(`magic-resend:ip:${ip}`, 5);
        enforceRateLimit(`magic-resend:renter:${auth!.renterId}`, 3);
        const { token, url } = await issueMagicLink(auth!.renterId);
        set.status = 200;
        return { message: "Đã gửi lại liên kết đăng nhập", url };
      },
      {
        detail: { security: [{ renterAuth: [] }] },
      },
    ),
  );