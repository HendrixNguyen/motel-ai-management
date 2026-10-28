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
  getLatestRenterContract,
  acceptRenterContractConsent,
  terminateContract,
  updateContract,
  updateContractTemplate,
  previewOwnedTemplate,
  copyContractTemplateFromCatalog,
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
const date = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
const vnd = t.String({ pattern: "^\\d+$", maxLength: 14 });
const templateBody = t.Object({
  name: t.String({ minLength: 1 }),
  clauses: t.Array(clause),
  isDefault: t.Optional(t.Boolean()),
});
const contractBody = t.Object({
  renterId: t.String({ format: "uuid" }),
  roomId: t.String({ format: "uuid" }),
  templateId: t.Optional(t.String({ format: "uuid" })),
  startDate: date,
  endDate: date,
  monthlyRent: t.Optional(vnd),
  deposit: t.Optional(vnd),
  clauses: t.Optional(t.Array(clause)),
});
const renterContractParams = t.Object({ contractId: t.String({ format: "uuid" }) });
const consentBody = t.Object({
  consent: t.Literal(true),
  termsVersion: t.String({ pattern: "^[a-f0-9]{64}$" }),
});
const contractPatch = t.Object({
  templateId: t.Optional(t.String({ format: "uuid" })),
  startDate: t.Optional(date),
  endDate: t.Optional(date),
  monthlyRent: t.Optional(vnd),
  deposit: t.Optional(vnd),
  clauses: t.Optional(t.Array(clause)),
});
const managerContractRoutes = new Elysia({ name: "manager-contract-routes" })
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
  .post(
    "/manager/motels/:motelId/contract-templates/from-catalog",
    async ({ params, auth, body, set }) => {
      set.status = 201;
      return copyContractTemplateFromCatalog(params.motelId, auth!.userId, body);
    },
    {
      params,
      body: t.Object({
        catalogKey: t.String({ minLength: 1 }),
        catalogVersion: t.Integer({ minimum: 1 }),
        isDefault: t.Boolean(),
      }),
    },
  )
  .get(
    "/manager/motels/:motelId/contract-templates/:templateId/setup-preview",
    ({ params, auth }) => previewOwnedTemplate(auth!.userId, params.motelId, params.templateId),
    { params: templateParams },
  )
  .get(
    "/manager/motels/:motelId/contract-templates/:templateId",
    ({ params, auth }) => getContractTemplate(params.motelId, params.templateId, auth!.userId),
    { params: templateParams },
  )
  .patch(
    "/manager/motels/:motelId/contract-templates/:templateId",
    ({ params, auth, body }) =>
      updateContractTemplate(params.motelId, params.templateId, auth!.userId, body),
    { params: templateParams, body: t.Partial(templateBody) },
  )
  .delete(
    "/manager/motels/:motelId/contract-templates/:templateId",
    async ({ params, auth, set }) => {
      await deleteContractTemplate(params.motelId, params.templateId, auth!.userId);
      set.status = 204;
      return "";
    },
    { params: templateParams },
  )
  .get(
    "/manager/motels/:motelId/contracts",
    ({ params, query, auth }) => listContracts(params.motelId, auth!.userId, query.status),
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
    ({ params, auth }) => getContract(params.motelId, params.contractId, auth!.userId),
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
    ({ params, auth }) => sendContract(params.motelId, params.contractId, auth!.userId),
    { params: contractParams },
  )
  .post(
    "/manager/motels/:motelId/contracts/:contractId/terminate",
    ({ params, auth }) => terminateContract(params.motelId, params.contractId, auth!.userId),
    { params: contractParams },
  );

const renterContractRoutes = new Elysia({ name: "renter-contract-routes" })
  .use(cookie())
  .use(renterAuth)
  .get("/renter/contract", ({ auth }) => getLatestRenterContract(auth!.renterId, auth!.motelId))
  .group("/renter/contracts/:contractId", (contractApp) =>
    contractApp
      .get(
        "",
        ({ params, auth }) => getRenterContract(params.contractId, auth!.renterId, auth!.motelId),
        { params: renterContractParams },
      )
      .post(
        "/consent",
        ({ params, auth, body }) =>
          acceptRenterContractConsent(
            params.contractId,
            auth!.renterId,
            auth!.motelId,
            body.termsVersion,
          ),
        { params: renterContractParams, body: consentBody },
      ),
  );

export const contractRoutes = new Elysia({ name: "contract-routes" })
  .use(managerContractRoutes)
  .use(renterContractRoutes);
