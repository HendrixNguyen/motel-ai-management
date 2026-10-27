import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { managerAuth } from "@/middleware/manager-auth";
import {
  listContractCatalog,
  previewCatalogTemplate,
} from "./contract-catalog.service";

export const contractCatalogRoutes = new Elysia({
  name: "contract-catalog-routes",
})
  .use(cookie())
  .use(managerAuth)
  .get("/manager/contract-template-catalog", () => listContractCatalog())
  .get(
    "/manager/contract-template-catalog/:key/:version",
    ({ params }) =>
      previewCatalogTemplate(params.key, Number(params.version)),
    {
      params: t.Object({
        key: t.String({ minLength: 1 }),
        version: t.Numeric({ minimum: 1 }),
      }),
    },
  );
