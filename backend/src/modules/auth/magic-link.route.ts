import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { jwt } from "@elysiajs/jwt";
import { env } from "@/config";
import { renterAuth } from "@/middleware/renter-auth";
import { consumeMagicLink, issueMagicLink } from "@/shared/magic-link";
import { AppError } from "@/shared/errors";

const COOKIE_NAME = "renter_session";

export const magicLinkRoutes = new Elysia({ name: "magic-link-routes" })
  .use(cookie())
  .use(jwt({ name: "renterJwt", secret: env.renterSessionSecret, exp: "24h" }))
  .post(
    "/renter/magic-links/exchange",
    async ({ body, renterJwt, cookie, set }) => {
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
      async ({ auth, set }) => {
        const { token, url } = await issueMagicLink(auth!.renterId);
        set.status = 200;
        return { message: "Đã gửi lại liên kết đăng nhập", url };
      },
      {
        detail: { security: [{ renterAuth: [] }] },
      },
    ),
  );