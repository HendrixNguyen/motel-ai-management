import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "@/config";
import { errorHandler } from "@/middleware/error-handler";
import { authRoutes } from "@/modules/auth/auth.route";
import { magicLinkRoutes } from "@/modules/auth/magic-link.route";
import { motelRoutes } from "@/modules/motel/motel.route";
import { renterRoutes } from "@/modules/renter/renter.route";
import { roomRoutes } from "@/modules/room/room.route";
import { billingRoutes } from "@/modules/billing/billing.route";
import { contractRoutes } from "@/modules/contract/contract.route";
import { AppError } from "@/shared/errors";
import { notificationRoutes } from "@/modules/notification/notification.route";
import { renterPortalRoutes } from "@/modules/renter-portal/renter-portal.route";
import { ticketRoutes } from "@/modules/ticket/ticket.route";
import { paymentRoutes } from "@/modules/payment/payment.route";
import { getRenterNotificationRecipient } from "@/modules/renter/renter.service";
import { setNotificationRecipientResolver } from "@/modules/notification/notification.service";

setNotificationRecipientResolver(getRenterNotificationRecipient);

/**
 * A fresh instance per call. `app` is the one the server listens on; tests build their own
 * so a throwing route can be registered on it without a test-only route existing in
 * production code.
 *
 * CORS is permissive outside production and `origin: false` in production. The production
 * setting is the one that governs, and it is the one the frontend relies on: the browser only
 * ever calls a relative `/api/...`, which `frontend/next.config.ts` rewrites onto this server,
 * so every real request is same-origin and never preflighted (ADR-0008). The permissive
 * development branch only stops `next dev` on localhost from being blocked.
 *
 * Do not add an origin allowlist to make a browser call succeed. CORS is not an authorisation
 * control, and the tenant boundary is the session cookie plus `motel-scope`, not a header.
 */
export function createApp() {
  return new Elysia()
    .onError(errorHandler)
    .use(cors({ origin: env.nodeEnv === "production" ? false : true, credentials: true }))
    .get("/health", () => ({ status: "ok" as const }))
    .group("/api", (api) =>
      api
        .use(authRoutes)
        .use(magicLinkRoutes)
        .use(motelRoutes)
       .use(roomRoutes)
       .use(billingRoutes)
       .use(contractRoutes)
       .use(renterRoutes)
        .use(notificationRoutes)
        .use(renterPortalRoutes)
          .use(ticketRoutes)
          .use(paymentRoutes),
    )
    .all("*", () => {
      throw AppError.notFound("Không tìm thấy");
    });
}

export const app = createApp();