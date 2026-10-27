import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, type DbExecutor } from "@/db";
import { AppError } from "@/shared/errors";
import { contractTemplateCatalog } from "./contract-catalog.schema";
import type {
  CatalogSummary,
  TemplatePreview,
} from "./contract-catalog.types";
import type { ContractTemplateClause } from "./contract.schema";

export function computeTemplateFingerprint(
  name: string,
  clauses: ContractTemplateClause[],
): string {
  const normalized = JSON.stringify({
    clauses: clauses.map((c) => ({
      content: c.content,
      title: c.title,
    })),
    name,
  });
  return createHash("sha256").update(normalized).digest("hex");
}

export async function listContractCatalog(
  executor: DbExecutor = db,
): Promise<CatalogSummary[]> {
  const rows = await executor
    .select({
      key: contractTemplateCatalog.key,
      version: contractTemplateCatalog.version,
      name: contractTemplateCatalog.name,
      description: contractTemplateCatalog.description,
    })
    .from(contractTemplateCatalog)
    .where(eq(contractTemplateCatalog.active, true))
    .orderBy(
      contractTemplateCatalog.key,
      desc(contractTemplateCatalog.version),
    );

  const newestByKey = new Map<string, CatalogSummary>();
  for (const row of rows) {
    if (!newestByKey.has(row.key)) {
      newestByKey.set(row.key, row);
    }
  }

  return Array.from(newestByKey.values());
}

export async function previewCatalogTemplate(
  key: string,
  version: number,
  executor: DbExecutor = db,
): Promise<TemplatePreview> {
  const [row] = await executor
    .select()
    .from(contractTemplateCatalog)
    .where(
      and(
        eq(contractTemplateCatalog.key, key),
        eq(contractTemplateCatalog.version, version),
        eq(contractTemplateCatalog.active, true),
      ),
    )
    .limit(1);

  if (!row) {
    throw AppError.notFound("Không tìm thấy mẫu hợp đồng");
  }

  return {
    name: row.name,
    clauses: row.clauses,
    selection: {
      kind: "catalog",
      key: row.key,
      version: row.version,
    },
  };
}
