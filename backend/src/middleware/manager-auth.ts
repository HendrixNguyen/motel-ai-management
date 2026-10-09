import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { env } from "@/config";
import { AppError } from "@/shared/errors";

export interface ManagerAuthPayload { userId: string; email: string }

export const managerAuth = new Elysia({ name: "manager-auth" })
  .use(jwt({ name: "manager", secret: env.managerJwtSecret, exp: "7d" }))
  .derive({ as: "scoped" }, async ({ manager, cookie }) => {
    const managerCookie = cookie?.manager_session as { value: string } | undefined;
    const token = managerCookie?.value;

    if (!token) {
      return { auth: undefined as ManagerAuthPayload | undefined };
    }

    const payload = await manager.verify(token);
    if (!payload) {
      return { auth: undefined as ManagerAuthPayload | undefined };
    }

    return { auth: { userId: payload.userId as string, email: payload.email as string } };
  })
  .onBeforeHandle({ as: "scoped" }, ({ auth, set }) => {
    if (!auth) {
      set.status = 401;
      return { error: "Chưa đăng nhập", code: "UNAUTHORIZED" };
    }
  });