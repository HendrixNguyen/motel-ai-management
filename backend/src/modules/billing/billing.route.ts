import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { managerAuth } from "@/middleware/manager-auth";
import {
  createBillingPeriod,
  generateInvoices,
  getBillingPeriod,
  getMeterPhoto,
  listBillingPeriods,
  listInvoices,
  markInvoiceOverdue,
  sendBillingPeriod,
  updateMeterReadings,
  uploadMeterPhoto,
} from "./billing.service";
import {
  getMonthlyUtilityCosts,
  getMonthlyUtilityReport,
  monthlyUtilityCostsBody,
  monthlyUtilityCostsParams,
  upsertMonthlyUtilityCosts,
} from "./monthly-utility-costs.service";

const params = t.Object({ motelId: t.String({ format: "uuid" }) });
const detailParams = t.Object({
  motelId: t.String({ format: "uuid" }),
  periodId: t.String({ format: "uuid" }),
});
const createBody = t.Object({ month: t.Integer({ minimum: 1, maximum: 12 }), year: t.Integer() });
const readingBody = t.Object({
  readings: t.Array(
    t.Object({
      roomId: t.String({ format: "uuid" }),
      type: t.Union([t.Literal("electric"), t.Literal("water")]),
      currentReading: t.String(),
      photoUrl: t.Optional(t.Nullable(t.String())),
      expectedUpdatedAt: t.String({ pattern: "^\\d+$" }),
    }),
    { minItems: 1 },
  ),
});

export const billingRoutes = new Elysia({ name: "billing-routes" })
  .use(cookie())
  .use(managerAuth)
  .get(
    "/manager/motels/:motelId/billing/months/:year/:month/utility-costs",
    ({ params, auth }) =>
      getMonthlyUtilityCosts(
        params.motelId,
        { userId: auth!.userId, role: auth!.role },
        params.year,
        params.month,
      ),
    { params: monthlyUtilityCostsParams },
  )
  .get(
    "/manager/motels/:motelId/billing/months/:year/:month/report",
    ({ params, auth }) =>
      getMonthlyUtilityReport(
        params.motelId,
        { userId: auth!.userId, role: auth!.role },
        params.year,
        params.month,
      ),
    { params: monthlyUtilityCostsParams },
  )
  .put(
    "/manager/motels/:motelId/billing/months/:year/:month/utility-costs",
    ({ params, body, auth }) =>
      upsertMonthlyUtilityCosts(
        params.motelId,
        { userId: auth!.userId, role: auth!.role },
        params.year,
        params.month,
        body,
      ),
    { params: monthlyUtilityCostsParams, body: monthlyUtilityCostsBody },
  )
  .get(
    "/manager/motels/:motelId/billing/periods",
    ({ params, auth }) =>
      listBillingPeriods(params.motelId, { userId: auth!.userId, role: auth!.role }),
    { params },
  )
  .post(
    "/manager/motels/:motelId/billing/periods",
    async ({ params, body, auth, set }) => {
      const result = await createBillingPeriod(
        params.motelId,
        { userId: auth!.userId, role: auth!.role },
        body,
      );
      set.status = 201;
      return result;
    },
    { params, body: createBody },
  )
  .get(
    "/manager/motels/:motelId/billing/periods/:periodId",
    ({ params, auth }) =>
      getBillingPeriod(params.periodId, params.motelId, { userId: auth!.userId, role: auth!.role }),
    { params: detailParams },
  )
  .put(
    "/manager/motels/:motelId/billing/periods/:periodId/readings",
    ({ params, body, auth }) =>
      updateMeterReadings(
        params.periodId,
        params.motelId,
        { userId: auth!.userId, role: auth!.role },
        body,
      ),
    { params: detailParams, body: readingBody },
  )
  .post(
    "/manager/motels/:motelId/billing/periods/:periodId/readings/:readingId/photo",
    async ({ params, body, auth, set }) => {
      const file = (body as { file: File }).file;
      const result = await uploadMeterPhoto(
        params.motelId,
        params.periodId,
        params.readingId,
        { userId: auth!.userId, role: auth!.role },
        file,
      );
      set.status = 201;
      return result;
    },
    {
      params: t.Object({
        motelId: t.String({ format: "uuid" }),
        periodId: t.String({ format: "uuid" }),
        readingId: t.String({ format: "uuid" }),
      }),
      body: t.Object({ file: t.File({ type: ["image/jpeg", "image/png"], maxSize: "10m" }) }),
    },
  )
  .get(
    "/manager/motels/:motelId/billing/periods/:periodId/readings/:readingId/photo",
    ({ params, auth }) =>
      getMeterPhoto(params.motelId, params.periodId, params.readingId, {
        userId: auth!.userId,
        role: auth!.role,
      }),
    {
      params: t.Object({
        motelId: t.String({ format: "uuid" }),
        periodId: t.String({ format: "uuid" }),
        readingId: t.String({ format: "uuid" }),
      }),
    },
  )
  .post(
    "/manager/motels/:motelId/billing/periods/:periodId/invoices",
    ({ params, auth }) =>
      generateInvoices(params.periodId, params.motelId, { userId: auth!.userId, role: auth!.role }),
    { params: detailParams },
  )
  .get(
    "/manager/motels/:motelId/billing/periods/:periodId/invoices",
    ({ params, auth }) =>
      listInvoices(params.periodId, params.motelId, { userId: auth!.userId, role: auth!.role }),
    { params: detailParams },
  )
  .post(
    "/manager/motels/:motelId/billing/periods/:periodId/send",
    ({ params, auth }) =>
      sendBillingPeriod(params.periodId, params.motelId, {
        userId: auth!.userId,
        role: auth!.role,
      }),
    { params: detailParams },
  )
  .patch(
    "/manager/motels/:motelId/billing/invoices/:invoiceId/paid",
    ({ set }) => {
      set.status = 410;
      return { error: "Sử dụng cash-confirmation hoặc payment-proof/approve", code: "GONE" };
    },
    {
      params: t.Object({
        motelId: t.String({ format: "uuid" }),
        invoiceId: t.String({ format: "uuid" }),
      }),
    },
  )
  .patch(
    "/manager/motels/:motelId/billing/invoices/:invoiceId/overdue",
    ({ params, auth }) =>
      markInvoiceOverdue(params.invoiceId, params.motelId, {
        userId: auth!.userId,
        role: auth!.role,
      }),
    {
      params: t.Object({
        motelId: t.String({ format: "uuid" }),
        invoiceId: t.String({ format: "uuid" }),
      }),
    },
  );
