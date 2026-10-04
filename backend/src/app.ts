import { Elysia } from "elysia";
import { errorHandler } from "@/middleware/error-handler";

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
    .onNotFound(({ set }) => {
      set.status = 404;
      return { error: "Không tìm thấy", code: "NOT_FOUND" };
    })
    .get("/health", () => ({ status: "ok" as const }));
}

export const app = createApp();