import { randomBytes, timingSafeEqual } from "node:crypto";
import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { jwt } from "@elysiajs/jwt";
import { env } from "@/config";
import { managerAuth } from "@/middleware/manager-auth";
import { resolveOwnedMotel } from "@/middleware/tenancy";
import { verifyManager, registerManager } from "./auth.service";
import { issueMagicLink } from "@/shared/magic-link";
import { AppError } from "@/shared/errors";
import { getRenter } from "@/modules/renter/renter.service";
import { enforceRateLimit } from "@/shared/rate-limit";
import { issueLoginRequestLink, listLoginRequests, markLoginRequestHandled } from "./renter-login-request.service";
import { getMotelPublicAccessCode } from "@/modules/motel/motel.service";
import { adminAuth } from "@/middleware/admin-auth";
import { createManager, listAccounts, resetManagerPassword, setManagerEnabled } from "./admin-account.service";

const COOKIE_NAME = "manager_session";

export const adminAccountRoutes = new Elysia({ name: "admin-account-routes" })
  .use(cookie())
  .use(jwt({ name: "manager", secret: env.managerJwtSecret, exp: "7d" }))
  .use(jwt({ name: "admin", secret: env.adminJwtSecret, exp: "7d" }))
  .use(managerAuth)
  .group("/admin", (app) => app.use(adminAuth)
  .onBeforeHandle({ as: "scoped" }, ({ auth, set }) => {
    if (auth!.role !== "superadmin") {
      set.status = 403;
      return { error: "Không có quyền", code: "FORBIDDEN" };
    }
  })
  .get("/managers", async ({ query, auth, set }) => {
    set.headers["cache-control"] = "no-store";
    set.headers["x-csrf-token"] = auth!.csrfToken!;
    return listAccounts(query.limit, query.offset);
  }, { query: t.Object({ limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })), offset: t.Optional(t.Numeric({ minimum: 0 })) }), detail: { security: [{ adminAuth: [] }] } })
  .post("/managers", async ({ body, auth, set, request }) => {
    await requireCsrf(request.headers.get("x-csrf-token"), auth!.csrfToken!);
    set.headers["cache-control"] = "no-store";
    set.status = 201;
    return createManager(body, auth!.userId);
  }, { body: t.Object({ email: t.String({ format: "email" }), name: t.String({ minLength: 1, maxLength: 160 }), password: t.String({ minLength: 8, maxLength: 256 }), phone: t.Optional(t.String({ maxLength: 40 })) }), detail: { security: [{ adminAuth: [] }] } })
  .patch("/managers/:managerId", async ({ params, body, auth, request }) => {
    await requireCsrf(request.headers.get("x-csrf-token"), auth!.csrfToken!);
    await setManagerEnabled(params.managerId, body.enabled, auth!.userId);
    return { success: true };
  }, {
    params: t.Object({ managerId: t.String({ format: "uuid" }) }), body: t.Object({ enabled: t.Boolean() }), detail: { security: [{ adminAuth: [] }] },
  })
  .post("/managers/:managerId/reset-password", async ({ params, body, auth, request }) => {
    await requireCsrf(request.headers.get("x-csrf-token"), auth!.csrfToken!);
    await enforceRateLimit(`admin:reset:ip:${clientKey(request)}`, 10);
    await resetManagerPassword(params.managerId, body.password, auth!.userId);
    return { success: true };
  }, { params: t.Object({ managerId: t.String({ format: "uuid" }) }), body: t.Object({ password: t.String({ minLength: 8, maxLength: 256 }) }), detail: { security: [{ adminAuth: [] }] } }));

function createCsrfToken() {
  return randomBytes(32).toString("base64url");
}

async function requireCsrf(supplied: string | null, expected: string): Promise<void> {
  if (typeof supplied !== "string" || typeof expected !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(supplied) || Buffer.byteLength(supplied) !== Buffer.byteLength(expected))
    throw AppError.forbidden("Yêu cầu không hợp lệ");
  if (!timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
    throw AppError.forbidden("Yêu cầu không hợp lệ");
}

function clientKey(request: Request): string {
  return env.trustedProxyHeader &&
    env.trustedProxyAssertionHeader &&
    env.trustedProxyAssertionValue &&
    request.headers.get(env.trustedProxyAssertionHeader) === env.trustedProxyAssertionValue
    ? request.headers.get(env.trustedProxyHeader)?.split(",")[0]?.trim() || "unknown"
    : "unknown";
}

export const authRoutes = new Elysia({ name: "auth-routes" })
  .use(cookie())
  .use(jwt({ name: "manager", secret: env.managerJwtSecret, exp: "7d" }))
  .use(jwt({ name: "admin", secret: env.adminJwtSecret, exp: "7d" }))
  .post(
    "/auth/register",
    async ({ body, manager, cookie, set, request }) => {
      const ip = clientKey(request);
      await enforceRateLimit(`register:ip:${ip}`, 10);
      await enforceRateLimit(`register:email:${body.email.trim().toLowerCase()}`, 5);
      const managerRow = await registerManager(body);
      const token = await manager.sign({ userId: managerRow.id, email: managerRow.email, sessionVersion: managerRow.sessionVersion });
      cookie[COOKIE_NAME]?.set({ value: token, httpOnly: true, secure: env.nodeEnv === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/" });
      set.headers["cache-control"] = "no-store";
      set.status = 201;
      return { id: managerRow.id, email: managerRow.email, name: managerRow.name, role: managerRow.role };
    },
    { body: t.Object({ email: t.String({ format: "email" }), password: t.String({ minLength: 8, maxLength: 256 }), name: t.String({ minLength: 1, maxLength: 160 }), phone: t.Optional(t.String({ maxLength: 40 })) }) },
  )
  .post(
    "/auth/login",
    async ({ body, manager, admin, cookie, set, request }) => {
      const ip = clientKey(request);
      await enforceRateLimit(`login:ip:${ip}`, 10);
      await enforceRateLimit(`login:email:${body.email.trim().toLowerCase()}`, 5);
      const managerRow = await verifyManager(body.email, body.password);
      const csrfToken = managerRow.role === "superadmin" ? createCsrfToken() : undefined;
      const payload = { userId: managerRow.id, email: managerRow.email, sessionVersion: managerRow.sessionVersion, ...(csrfToken ? { csrfToken } : {}) };
      const token = managerRow.role === "superadmin" ? await admin.sign(payload) : await manager.sign(payload);
      set.headers["cache-control"] = "no-store";
      cookie[COOKIE_NAME]?.set({
        value: token,
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      return { id: managerRow.id, email: managerRow.email, name: managerRow.name, role: managerRow.role, ...(csrfToken ? { csrfToken } : {}) };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 1 }),
      }),
    },
  )
  .group("/auth", (app) => app.use(managerAuth)
    .post("/logout", async ({ cookie, set }) => {
      cookie[COOKIE_NAME]?.remove();
      set.status = 204;
      return "";
    })
    .get(
      "/me",
      async ({ auth }) => {
        return { id: auth!.userId, email: auth!.email, role: auth!.role };
      },
      {
        detail: { security: [{ managerAuth: [] }] },
      },
    ),
  )
  .group("/manager", (app) => app.use(managerAuth)
    .group("/motels/:motelId/login-requests", (app) => app
     .get("/", ({ params, auth }) => listLoginRequests(params.motelId, auth!.userId), { params: t.Object({ motelId: t.String({ format: "uuid" }) }), detail: { security: [{ managerAuth: [] }] } })
     .post("/:requestId/link", ({ params, auth }) => issueLoginRequestLink(params.requestId, params.motelId, auth!.userId), { params: t.Object({ motelId: t.String({ format: "uuid" }), requestId: t.String({ format: "uuid" }) }), detail: { security: [{ managerAuth: [] }] } })
     .post("/:requestId/handled", ({ params, auth }) => markLoginRequestHandled(params.requestId, params.motelId, auth!.userId, "handled"), { params: t.Object({ motelId: t.String({ format: "uuid" }), requestId: t.String({ format: "uuid" }) }), detail: { security: [{ managerAuth: [] }] } })
     .post("/:requestId/dismiss", ({ params, auth }) => markLoginRequestHandled(params.requestId, params.motelId, auth!.userId, "dismissed"), { params: t.Object({ motelId: t.String({ format: "uuid" }), requestId: t.String({ format: "uuid" }) }), detail: { security: [{ managerAuth: [] }] } }))
    .group("/motels/:motelId/renter-recovery", (app) => app
      .get("/code", ({ params, auth }) => getMotelPublicAccessCode(params.motelId, auth!.userId), { params: t.Object({ motelId: t.String({ format: "uuid" }) }), detail: { security: [{ managerAuth: [] }] } }))
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
