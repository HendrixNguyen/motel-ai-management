import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { managers } from "@/modules/auth/auth.schema";
import { jwt } from "@elysiajs/jwt";
import { env } from "@/config";

export interface ManagerAuthPayload {
  userId: string;
  email: string;
  role: "manager" | "superadmin";
  sessionVersion: number;
  csrfToken?: string;
}

export const managerAuth = new Elysia({ name: "manager-auth" })
  .use(jwt({ name: "manager", secret: env.managerJwtSecret, exp: "7d" }))
  .use(jwt({ name: "admin", secret: env.adminJwtSecret, exp: "7d" }))
  .derive({ as: "scoped" }, async ({ manager, admin, cookie }) => {
    const managerCookie = cookie?.manager_session as { value: string } | undefined;
    const token = managerCookie?.value;

    if (!token) {
      return { auth: undefined as ManagerAuthPayload | undefined };
    }

    const managerPayload = await manager.verify(token);
    const payload = managerPayload !== false ? managerPayload : await admin.verify(token);
    if (!payload || typeof payload.userId !== "string" || typeof payload.sessionVersion !== "number") {
      return { auth: undefined as ManagerAuthPayload | undefined };
    }

    const [account] = await db
      .select({ id: managers.id, email: managers.email, role: managers.role, disabledAt: managers.disabledAt, sessionVersion: managers.sessionVersion, passwordHash: managers.passwordHash })
      .from(managers)
      .where(eq(managers.id, payload.userId))
      .limit(1);

    if (
      !account ||
      account.disabledAt ||
      !account.passwordHash ||
      account.sessionVersion !== payload.sessionVersion ||
      (managerPayload !== false && account.role !== "manager") ||
      (managerPayload === false && account.role !== "superadmin")
    ) {
      return { auth: undefined as ManagerAuthPayload | undefined };
    }

    return { auth: { userId: account.id, email: account.email, role: account.role, sessionVersion: account.sessionVersion, ...(typeof payload.csrfToken === "string" ? { csrfToken: payload.csrfToken } : {}) } };
  })
  .onBeforeHandle({ as: "scoped" }, ({ auth, set, path }) => {
    if (!auth) {
      set.status = 401;
      return { error: "Chưa đăng nhập", code: "UNAUTHORIZED" };
    }
    if (path.startsWith("/api/manager/") && auth.role !== "manager") {
      set.status = 403;
      return { error: "Không có quyền", code: "FORBIDDEN" };
    }
  });
