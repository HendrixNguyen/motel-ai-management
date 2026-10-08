import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { renterAuth, requireRenterAuth } from "@/middleware/renter-auth";
import { getRenterMe, listRenterInvoices, listRenterPeriods, getRenterInvoice } from "./renter-portal.service";

const periodParams = t.Object({ periodId: t.String({ format: "uuid" }) });
const invoiceParams = t.Object({ invoiceId: t.String({ format: "uuid" }) });

export const renterPortalRoutes = new Elysia({ name: "renter-portal-routes" })
  .use(cookie())
  .use(renterAuth)
  .get("/renter/me", ({ auth }) => getRenterMe(requireRenterAuth(auth)), { detail: { security: [{ renterAuth: [] }] } })
  .get("/renter/billing/periods", ({ auth }) => listRenterPeriods(requireRenterAuth(auth)), { detail: { security: [{ renterAuth: [] }] } })
  .get("/renter/billing/periods/:periodId/invoices", ({ auth, params }) => listRenterInvoices(requireRenterAuth(auth), params.periodId), { params: periodParams, detail: { security: [{ renterAuth: [] }] } })
  .get("/renter/invoices/:invoiceId", ({ auth, params }) => getRenterInvoice(requireRenterAuth(auth), params.invoiceId), { params: invoiceParams, detail: { security: [{ renterAuth: [] }] } });
