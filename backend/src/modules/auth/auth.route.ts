import { db } from "@/db";
import { motels } from "@/db/schemas";
import { eq, and } from "drizzle-orm";
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
import { seedData } from "@/db/seed";

const COOKIE_NAME = "manager_session";
const SEED_TOKEN = env.nodeEnv === "production" ? undefined : ("11ad7312922e5a6ad1d2b9acf076e249b716f33d191234d3ad4a029569ed70ff" as const);

function clientKey(request: Request): string {
  return env.trustedProxyHeader && env.trustedProxyAssertionHeader && env.trustedProxyAssertionValue && request.headers.get(env.trustedProxyAssertionHeader) === env.trustedProxyAssertionValue ? request.headers.get(env.trustedProxyHeader)?.split(",")[0]?.trim() || "unknown" : "unknown";
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
  )
  .group("/qa", (app) =>
    app.post(
      "/seed",
      async ({ request, set }) => {
        if (env.nodeEnv === "production") {
          set.status = 403;
          return { error: "Seed not allowed in production" };
        }
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader || !SEED_TOKEN || authHeader !== `Bearer ${SEED_TOKEN}`) {
          set.status = 401;
          return { error: "Invalid seed token" };
        }
        await seedData();
        return { success: true, message: "Seed completed" };
      },
      {
        detail: { security: [] },
      },
    )
    .get(
      "/db-test",
      async ({ set }) => {
        try {
          const result = await db.select().from(motels).where(and(eq(motels.id, "22222222-2222-2222-2222-222222222222"), eq(motels.managerId, "11111111-1111-1111-1111-111111111111")));
          return { success: true, data: result };
        } catch (error: any) {
          console.error("DB test error:", error);
          set.status = 500;
          return { error: error.message, cause: error.cause?.message, stack: error.stack };
        }
      },
      { detail: { security: [] } },
    ),
  );