import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { managerAuth } from "@/middleware/manager-auth";
import { renterAuth, requireRenterAuth } from "@/middleware/renter-auth";
import {
  approvePaymentProof,
  confirmCashPayment,
  getManagerPaymentProof,
  getRenterPaymentProof,
  rejectPaymentProof,
  submitPaymentProof,
} from "./payment.service";
import { AppError } from "@/shared/errors";

const renterParams = t.Object({ invoiceId: t.String({ format: "uuid" }) });
const managerParams = t.Object({
  motelId: t.String({ format: "uuid" }),
  invoiceId: t.String({ format: "uuid" }),
});
const rejectBody = t.Object({ reason: t.String({ minLength: 1, maxLength: 500 }) });
const uploadBody = t.Object({ file: t.File({ maxSize: 5_000_000 }) });

export const paymentRoutes = new Elysia({ name: "payment-routes" })
  .use(cookie())
  .group("", (routes) =>
    routes
      .use(renterAuth)
      .post(
        "/renter/invoices/:invoiceId/payment-proof",
        async ({ params, body, auth, set }) => {
          const file = (body as { file: File }).file;
          if (!["image/jpeg", "image/png"].includes(file.type))
            throw AppError.badRequest("Chỉ chấp nhận ảnh JPG hoặc PNG");
          const result = await submitPaymentProof(requireRenterAuth(auth), params.invoiceId, file);
          set.status = 201;
          return result;
        },
        { params: renterParams, body: uploadBody, detail: { security: [{ renterAuth: [] }] } },
      )
      .get(
        "/renter/invoices/:invoiceId/payment-proof",
        ({ params, auth }) => getRenterPaymentProof(requireRenterAuth(auth), params.invoiceId),
        { params: renterParams, detail: { security: [{ renterAuth: [] }] } },
      ),
  )
  .group("", (routes) =>
    routes
      .use(managerAuth)
      .get(
        "/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof",
        ({ params, auth }) =>
          getManagerPaymentProof(auth!.userId, params.motelId, params.invoiceId),
        { params: managerParams, detail: { security: [{ managerAuth: [] }] } },
      )
      .post(
        "/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof/approve",
        ({ params, auth }) => approvePaymentProof(auth!.userId, params.motelId, params.invoiceId),
        { params: managerParams, detail: { security: [{ managerAuth: [] }] } },
      )
      .post(
        "/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof/reject",
        ({ params, body, auth }) =>
          rejectPaymentProof(auth!.userId, params.motelId, params.invoiceId, body.reason),
        { params: managerParams, body: rejectBody, detail: { security: [{ managerAuth: [] }] } },
      )
      .post(
        "/manager/motels/:motelId/billing/invoices/:invoiceId/cash-confirmation",
        ({ params, auth }) => confirmCashPayment(auth!.userId, params.motelId, params.invoiceId),
        { params: managerParams, detail: { security: [{ managerAuth: [] }] } },
      ),
  );
