import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { managerAuth } from "@/middleware/manager-auth";
import { createContractTemplate, deleteContractTemplate, getContractTemplate, listContractTemplates, updateContractTemplate } from "./contract.service";
import type { ContractTemplateInput, UpdateContractTemplateInput } from "./contract.types";
const params = t.Object({ motelId: t.String({ format: "uuid" }) });
const templateParams = t.Object({ motelId: t.String({ format: "uuid" }), templateId: t.String({ format: "uuid" }) });
const clause = t.Object({ title: t.String({ minLength: 1 }), content: t.String({ minLength: 1 }) });
const body = t.Object({ name: t.String({ minLength: 1 }), clauses: t.Array(clause), isDefault: t.Optional(t.Boolean()) });
export const contractRoutes = new Elysia({ name: "contract-routes" }).use(cookie()).use(managerAuth)
  .get("/manager/motels/:motelId/contract-templates", ({ params, auth }) => listContractTemplates(params.motelId, auth!.userId), { params })
  .post("/manager/motels/:motelId/contract-templates", async ({ params, auth, body, set }) => { set.status = 201; return createContractTemplate(params.motelId, auth!.userId, body); }, { params, body })
  .get("/manager/motels/:motelId/contract-templates/:templateId", ({ params, auth }) => getContractTemplate(params.motelId, params.templateId, auth!.userId), { params: templateParams })
  .patch("/manager/motels/:motelId/contract-templates/:templateId", ({ params, auth, body }) => updateContractTemplate(params.motelId, params.templateId, auth!.userId, body), { params: templateParams, body: t.Partial(body) })
  .delete("/manager/motels/:motelId/contract-templates/:templateId", async ({ params, auth, set }) => { await deleteContractTemplate(params.motelId, params.templateId, auth!.userId); set.status = 204; return ""; }, { params: templateParams });
