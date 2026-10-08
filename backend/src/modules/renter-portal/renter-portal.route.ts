import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { renterAuth } from "@/middleware/renter-auth";
import { getRenterMe, listRenterInvoices, listRenterPeriods } from "./renter-portal.service";

const periodParams = t.Object({ periodId: t.String({ format: "uuid" }) });

export const renterPortalRoutes = new Elysia({ name: "renter-portal-routes" })
  .use(cookie())
  .use(renterAuth)
  .get("/renter/me", ({ auth }) => getRenterMe(auth!), { detail: { security: [{ renterAuth: [] }] } })
  .get("/renter/billing/periods", ({ auth }) => listRenterPeriods(auth!), { detail: { security: [{ renterAuth: [] }] } })
  .get("/renter/billing/periods/:periodId/invoices", ({ auth, params }) => listRenterInvoices(auth!, params.periodId), { params: periodParams, detail: { security: [{ renterAuth: [] }] } });
