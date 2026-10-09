import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { jwt } from "@elysiajs/jwt";
import { env } from "@/config";
import { managerAuth } from "@/middleware/manager-auth";
import { resolveOwnedMotel } from "@/middleware/tenancy";
import { registerManager, verifyManager } from "./auth.service";
import { issueMagicLink } from "@/shared/magic-link";
import { AppError } from "@/shared/errors";
import type { ManagerJwtPayload } from "./auth.types";
import { getRenter } from "@/modules/renter/renter.service";
import { enforceRateLimit } from "@/shared/rate-limit";

const COOKIE_NAME = "manager_session";

function clientKey(request: Request): string {
  return env.trustedProxyHeader ? request.headers.get(env.trustedProxyHeader)?.split(",")[0]?.trim() || "unknown" : "unknown";
}

export const authRoutes = new Elysia({ name: "auth-routes" })
  .use(cookie())
  .use(jwt({ name: "manager", secret: env.managerJwtSecret, exp: "7d" }))
  .post(
    "/auth/register",
    async ({ body, manager, cookie, set }) => {
      const managerRow = await registerManager(body);
      const token = await manager.sign({ userId: managerRow.id, email: managerRow.email });
      cookie[COOKIE_NAME]?.set({
        value: token,
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      set.status = 201;
      return { id: managerRow.id, email: managerRow.email, name: managerRow.name };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8 }),
        name: t.String({ minLength: 1 }),
        phone: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/auth/login",
    async ({ body, manager, cookie, set, request }) => {
      const ip = clientKey(request);
      await enforceRateLimit(`login:ip:${ip}`, 10);
      await enforceRateLimit(`login:email:${body.email.trim().toLowerCase()}`, 5);
      const managerRow = await verifyManager(body.email, body.password);
      const token = await manager.sign({ userId: managerRow.id, email: managerRow.email });
      cookie[COOKIE_NAME]?.set({
        value: token,
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      return { id: managerRow.id, email: managerRow.email, name: managerRow.name };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 1 }),
      }),
    },
  )
  .post(
    "/auth/logout",
    async ({ cookie, set }) => {
      cookie[COOKIE_NAME]?.remove();
      set.status = 204;
      return "";
    },
  )
  .group("/auth", (app) =>
    app.use(managerAuth).get(
      "/me",
      async ({ auth }) => {
        return { id: auth!.userId, email: auth!.email };
      },
      {
        detail: { security: [{ managerAuth: [] }] },
      },
    ),
  )
  .group("/manager/motels/:motelId/renters/:renterId", (app) =>
    app.use(managerAuth).post(
      "/magic-link",
      async ({ params, auth, set }) => {
        const motel = await resolveOwnedMotel(params.motelId, auth!.userId);
        const renter = await getRenter(params.renterId);
        if (!renter || renter.motelId !== motel.id) {
          throw AppError.notFound("Không tìm thấy người thuê");
        }
         const { token, url } = await issueMagicLink(renter.id);
         set.status = 200;

        return { token, url };
      },
      {
        params: t.Object({
          motelId: t.String({ format: "uuid" }),
          renterId: t.String({ format: "uuid" }),
        }),
        detail: { security: [{ managerAuth: [] }] },
      },
    ),
  );