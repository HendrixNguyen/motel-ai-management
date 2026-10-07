import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { managerAuth } from "@/middleware/manager-auth";
import { renterAuth } from "@/middleware/renter-auth";
import {
  createContract,
  createContractTemplate,
  deleteContractTemplate,
  getContract,
  getContractTemplate,
  listContractTemplates,
  listContracts,
  sendContract,
  getRenterContract,
  requestContractOtp,
  verifyContractOtp,
  terminateContract,
  updateContract,
  updateContractTemplate,
} from "./contract.service";
const params = t.Object({ motelId: t.String({ format: "uuid" }) });
const templateParams = t.Object({
  motelId: t.String({ format: "uuid" }),
  templateId: t.String({ format: "uuid" }),
});
const contractParams = t.Object({
  motelId: t.String({ format: "uuid" }),
  contractId: t.String({ format: "uuid" }),
});
const clause = t.Object({
  title: t.String({ minLength: 1 }),
  content: t.String({ minLength: 1 }),
});
const templateBody = t.Object({
  name: t.String({ minLength: 1 }),
  clauses: t.Array(clause),
  isDefault: t.Optional(t.Boolean()),
});
const contractBody = t.Object({
  renterId: t.String({ format: "uuid" }),
  roomId: t.String({ format: "uuid" }),
  templateId: t.Optional(t.String({ format: "uuid" })),
  startDate: t.String(),
  endDate: t.String(),
  monthlyRent: t.Optional(t.String()),
  deposit: t.Optional(t.String()),
  clauses: t.Optional(t.Array(clause)),
});
const renterContractParams = t.Object({ contractId: t.String({ format: "uuid" }) });
const otpBody = t.Object({ otp: t.String({ pattern: "^[0-9]{6}$" }) });
const contractPatch = t.Object({
  templateId: t.Optional(t.String({ format: "uuid" })),
  startDate: t.Optional(t.String()),
  endDate: t.Optional(t.String()),
  monthlyRent: t.Optional(t.String()),
  deposit: t.Optional(t.String()),
  clauses: t.Optional(t.Array(clause)),
});
export const contractRoutes = new Elysia({ name: "contract-routes" })
  .use(cookie())
  .use(managerAuth)
  .get(
    "/manager/motels/:motelId/contract-templates",
    ({ params, auth }) => listContractTemplates(params.motelId, auth!.userId),
    { params },
  )
  .post(
    "/manager/motels/:motelId/contract-templates",
    async ({ params, auth, body, set }) => {
      set.status = 201;
      return createContractTemplate(params.motelId, auth!.userId, body);
    },
    { params, body: templateBody },
  )
  .get(
    "/manager/motels/:motelId/contract-templates/:templateId",
    ({ params, auth }) =>
      getContractTemplate(params.motelId, params.templateId, auth!.userId),
    { params: templateParams },
  )
  .patch(
    "/manager/motels/:motelId/contract-templates/:templateId",
    ({ params, auth, body }) =>
      updateContractTemplate(
        params.motelId,
        params.templateId,
        auth!.userId,
        body,
      ),
    { params: templateParams, body: t.Partial(templateBody) },
  )
  .delete(
    "/manager/motels/:motelId/contract-templates/:templateId",
    async ({ params, auth, set }) => {
      await deleteContractTemplate(
        params.motelId,
        params.templateId,
        auth!.userId,
      );
      set.status = 204;
      return "";
    },
    { params: templateParams },
  )
  .get(
    "/manager/motels/:motelId/contracts",
    ({ params, query, auth }) =>
      listContracts(params.motelId, auth!.userId, query.status),
    {
      params,
      query: t.Object({
        status: t.Optional(
          t.Union([
            t.Literal("draft"),
            t.Literal("active"),
            t.Literal("expired"),
            t.Literal("terminated"),
          ]),
        ),
      }),
    },
  )
  .post(
    "/manager/motels/:motelId/contracts",
    async ({ params, auth, body, set }) => {
      set.status = 201;
      return createContract(params.motelId, auth!.userId, body);
    },
    { params, body: contractBody },
  )
  .get(
    "/manager/motels/:motelId/contracts/:contractId",
    ({ params, auth }) =>
      getContract(params.motelId, params.contractId, auth!.userId),
    { params: contractParams },
  )
  .patch(
    "/manager/motels/:motelId/contracts/:contractId",
    ({ params, auth, body }) =>
      updateContract(params.motelId, params.contractId, auth!.userId, body),
    { params: contractParams, body: contractPatch },
  )
  .post(
    "/manager/motels/:motelId/contracts/:contractId/send",
    ({ params, auth }) =>
      sendContract(params.motelId, params.contractId, auth!.userId),
    { params: contractParams },
  )
   .post(
     "/manager/motels/:motelId/contracts/:contractId/terminate",
     ({ params, auth }) =>
       terminateContract(params.motelId, params.contractId, auth!.userId),
     { params: contractParams },
   )
   .group("/renter/contracts/:contractId", (app) =>
     app.use(renterAuth)
       .get("", ({ params, auth }) => getRenterContract(params.contractId, auth!.renterId, auth!.motelId), { params: renterContractParams })
       .post("/sign-request", ({ params, auth }) => requestContractOtp(params.contractId, auth!.renterId, auth!.motelId), { params: renterContractParams })
       .post("/verify", ({ params, auth, body }) => verifyContractOtp(params.contractId, auth!.renterId, auth!.motelId, body.otp), { params: renterContractParams, body: otpBody }),
   );
