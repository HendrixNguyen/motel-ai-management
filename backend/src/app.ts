import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "@/config";
import { errorHandler } from "@/middleware/error-handler";
import { authRoutes } from "@/modules/auth/auth.route";
import { magicLinkRoutes } from "@/modules/auth/magic-link.route";
import { motelRoutes } from "@/modules/motel/motel.route";
import { AppError } from "@/shared/errors";

/**
 * A fresh instance per call. `app` is the one the server listens on; tests build their own
 * so a throwing route can be registered on it without a test-only route existing in
 * production code.
 *
 * CORS is deliberately absent. It only means something once a browser holds a cookie, no
 * frontend exists yet, and an origin allowlist with no test is a security control nobody
 * has verified. It arrives with the sub-project that needs it.
 */
export function createApp() {
  return new Elysia()
    .onError(errorHandler)
    .use(cors({ origin: env.nodeEnv === "production" ? false : true, credentials: true }))
    .get("/health", () => ({ status: "ok" as const }))
    .group("/api", (api) => api.use(authRoutes).use(magicLinkRoutes).use(motelRoutes))
    .all("*", () => {
      throw AppError.notFound("Không tìm thấy");
    });
}

export const app = createApp();