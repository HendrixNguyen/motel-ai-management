import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { renterAuth, requireRenterAuth } from "@/middleware/renter-auth";
import { managerAuth } from "@/middleware/manager-auth";
import { enforceRateLimit } from "@/shared/rate-limit";
import { env } from "@/config";
import { submitPaymentProof, getRenterPaymentProof, getManagerPaymentProof, approvePaymentProof, rejectPaymentProof, confirmCashPayment } from "./payment.service";

const renterParams = t.Object({ invoiceId: t.String({ format: "uuid" }) });
const managerParams = t.Object({ motelId: t.String({ format: "uuid" }), invoiceId: t.String({ format: "uuid" }) });
const rejectBody = t.Object({ reason: t.String({ minLength: 1, maxLength: 500 }) });
function trustedIp(request: Request): string { return env.trustedProxyHeader && env.trustedProxyAssertionHeader && env.trustedProxyAssertionValue && request.headers.get(env.trustedProxyAssertionHeader) === env.trustedProxyAssertionValue ? request.headers.get(env.trustedProxyHeader)?.split(",")[0]?.trim() || "unknown" : "unknown"; }

export const paymentRoutes = new Elysia({ name: "payment-routes" })
  .use(cookie())
  .group("", (group) => group
    .use(renterAuth)
    .post("/renter/invoices/:invoiceId/payment-proof", async ({ params, body, auth, set, request }) => { const contentLength = Number(request.headers.get("content-length") ?? 0); if (contentLength > 10 * 1024 * 1024 + 1024) { set.status = 413; return { error: "Tệp vượt quá giới hạn 10 MB", code: "VALIDATION_ERROR" }; } await enforceRateLimit(`payment-upload:ip:${trustedIp(request)}`, 30); await enforceRateLimit(`payment-upload:invoice:${params.invoiceId}`, 5); const result = await submitPaymentProof(requireRenterAuth(auth), params.invoiceId, body as File); set.status = 201; return result; }, { params: renterParams, body: t.File({ type: ["image/jpeg", "image/png"], maxSize: "10m" }) })
    .get("/renter/invoices/:invoiceId/payment-proof", async ({ params, auth, set }) => { const result = await getRenterPaymentProof(requireRenterAuth(auth), params.invoiceId); if (!result) set.status = 404; return result; }, { params: renterParams })
  )
  .group("", (group) => group
    .use(managerAuth)
    .get("/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof", ({ params, auth }) => getManagerPaymentProof(auth!.userId, params.motelId, params.invoiceId), { params: managerParams })
    .post("/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof/approve", ({ params, auth }) => approvePaymentProof(auth!.userId, params.motelId, params.invoiceId), { params: managerParams })
    .post("/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof/reject", ({ params, body, auth }) => rejectPaymentProof(auth!.userId, params.motelId, params.invoiceId, body.reason), { params: managerParams, body: rejectBody })
    .post("/manager/motels/:motelId/billing/invoices/:invoiceId/cash-confirmation", ({ params, auth }) => confirmCashPayment(auth!.userId, params.motelId, params.invoiceId), { params: managerParams })
  );
