import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { managerAuth } from "@/middleware/manager-auth";
import { createBillingPeriod, generateInvoices, getBillingPeriod, getMeterPhoto, listBillingPeriods, listInvoices, markInvoiceOverdue, sendBillingPeriod, updateMeterReadings, uploadMeterPhoto } from "./billing.service";

const params = t.Object({ motelId: t.String({ format: "uuid" }) });
const detailParams = t.Object({ motelId: t.String({ format: "uuid" }), periodId: t.String({ format: "uuid" }) });
const createBody = t.Object({ month: t.Integer({ minimum: 1, maximum: 12 }), year: t.Integer() });
const readingBody = t.Object({ readings: t.Array(t.Object({ roomId: t.String({ format: "uuid" }), type: t.Union([t.Literal("electric"), t.Literal("water")]), currentReading: t.String(), photoUrl: t.Optional(t.Nullable(t.String())), expectedUpdatedAt: t.String({ format: "date-time" }) }), { minItems: 1 }) });

export const billingRoutes = new Elysia({ name: "billing-routes" })
  .use(cookie())
  .use(managerAuth)
  .get("/manager/motels/:motelId/billing/periods", ({ params, auth }) => listBillingPeriods(params.motelId, auth!.userId), { params })
  .post("/manager/motels/:motelId/billing/periods", async ({ params, body, auth, set }) => { const result = await createBillingPeriod(params.motelId, auth!.userId, body); set.status = 201; return result; }, { params, body: createBody })
  .get("/manager/motels/:motelId/billing/periods/:periodId", ({ params, auth }) => getBillingPeriod(params.periodId, params.motelId, auth!.userId), { params: detailParams })
  .put("/manager/motels/:motelId/billing/periods/:periodId/readings", ({ params, body, auth }) => updateMeterReadings(params.periodId, params.motelId, auth!.userId, body), { params: detailParams, body: readingBody })
  .post("/manager/motels/:motelId/billing/periods/:periodId/readings/:readingId/photo", async ({ params, body, auth, set }) => { const file = body as File; const result = await uploadMeterPhoto(params.motelId, params.periodId, params.readingId, auth!.userId, file); set.status = 201; return result; }, { params: t.Object({ motelId: t.String({ format: "uuid" }), periodId: t.String({ format: "uuid" }), readingId: t.String({ format: "uuid" }) }), body: t.File({ type: ["image/jpeg", "image/png"], maxSize: "10m" }) })
  .get("/manager/motels/:motelId/billing/periods/:periodId/readings/:readingId/photo", ({ params, auth }) => getMeterPhoto(params.motelId, params.periodId, params.readingId, auth!.userId), { params: t.Object({ motelId: t.String({ format: "uuid" }), periodId: t.String({ format: "uuid" }), readingId: t.String({ format: "uuid" }) }) })
  .post("/manager/motels/:motelId/billing/periods/:periodId/invoices", ({ params, auth }) => generateInvoices(params.periodId, params.motelId, auth!.userId), { params: detailParams })
  .get("/manager/motels/:motelId/billing/periods/:periodId/invoices", ({ params, auth }) => listInvoices(params.periodId, params.motelId, auth!.userId), { params: detailParams })
  .post("/manager/motels/:motelId/billing/periods/:periodId/send", ({ params, auth }) => sendBillingPeriod(params.periodId, params.motelId, auth!.userId), { params: detailParams })
  .patch("/manager/motels/:motelId/billing/invoices/:invoiceId/paid", ({ set }) => { set.status = 410; return { error: "Sử dụng cash-confirmation hoặc payment-proof/approve", code: "GONE" }; }, { params: t.Object({ motelId: t.String({ format: "uuid" }), invoiceId: t.String({ format: "uuid" }) }) })
  .patch("/manager/motels/:motelId/billing/invoices/:invoiceId/overdue", ({ params, auth }) => markInvoiceOverdue(params.invoiceId, params.motelId, auth!.userId), { params: t.Object({ motelId: t.String({ format: "uuid" }), invoiceId: t.String({ format: "uuid" }) }) });
