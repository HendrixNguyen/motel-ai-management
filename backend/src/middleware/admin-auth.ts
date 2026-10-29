import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cookie } from "@elysiajs/cookie";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { managers } from "@/modules/auth/auth.schema";
import { env } from "@/config";
import type { ManagerAuthPayload } from "./manager-auth";

export const adminAuth = new Elysia({ name: "superadmin-auth" })
  .use(cookie())
  .use(jwt({ name: "manager", secret: env.managerJwtSecret, exp: "7d" }))
  .use(jwt({ name: "admin", secret: env.adminJwtSecret, exp: "7d" }))
  .derive({ as: "scoped" }, async ({ manager, admin, cookie }) => {
    const token = (cookie?.manager_session as { value: string } | undefined)?.value;
    if (!token) return { auth: undefined as ManagerAuthPayload | undefined };
    const managerPayload = await manager.verify(token);
    const payload = managerPayload !== false ? managerPayload : await admin.verify(token);
    if (!payload || typeof payload.userId !== "string" || typeof payload.sessionVersion !== "number")
      return { auth: undefined as ManagerAuthPayload | undefined };
    const [account] = await db
      .select({ id: managers.id, email: managers.email, role: managers.role, disabledAt: managers.disabledAt, sessionVersion: managers.sessionVersion, passwordHash: managers.passwordHash })
      .from(managers)
      .where(eq(managers.id, payload.userId))
      .limit(1);
    if (!account || account.disabledAt || !account.passwordHash || account.sessionVersion !== payload.sessionVersion || (account.role === "superadmin" && typeof payload.csrfToken !== "string"))
      return { auth: undefined as ManagerAuthPayload | undefined };
    return { auth: { userId: account.id, email: account.email, role: account.role, sessionVersion: account.sessionVersion, ...(typeof payload.csrfToken === "string" ? { csrfToken: payload.csrfToken } : {}) } };
  })
  .onBeforeHandle({ as: "scoped" }, ({ auth, set }) => {
    if (!auth) {
      set.status = 401;
      return { error: "Chưa đăng nhập", code: "UNAUTHORIZED" };
    }
  });
