import { and, asc, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, type DbExecutor, type DbTransaction } from "@/db";
import { seedContractTemplateCatalog } from "./contract-catalog.seed";
import { resolveOwnedMotel } from "@/middleware/tenancy";
import { AppError } from "@/shared/errors";
import { contractTemplateCatalog } from "./contract-catalog.schema";
import { contractTemplates, type ContractTemplateClause } from "./contract.schema";
import type { CatalogSummary, TemplatePreview } from "./contract-catalog.types";

export function seedContractCatalog(executor: DbTransaction): Promise<string[]> {
  return seedContractTemplateCatalog(executor);
}

export type CatalogTemplateResponse = {
  id: string;
  key: string;
  version: number;
  name: string;
  description: string;
  clauses: { title: string; content: string }[];
};

function catalogResponse(
  row: typeof contractTemplateCatalog.$inferSelect,
): CatalogTemplateResponse {
  if (
    !Array.isArray(row.clauses) ||
    row.clauses.some(
      (clause) =>
        !clause ||
        typeof clause.title !== "string" ||
        typeof clause.content !== "string" ||
        !clause.title.trim() ||
        !clause.content.trim(),
    )
  )
    throw AppError.badRequest("Mẫu hợp đồng có điều khoản không hợp lệ");
  return {
    id: row.id,
    key: row.key,
    version: row.version,
    name: row.name,
    description: row.description,
    clauses: row.clauses,
  };
}

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

export async function listContractCatalog(executor: DbExecutor = db): Promise<CatalogSummary[]> {
  const rows = await executor
    .select({
      key: contractTemplateCatalog.key,
      version: contractTemplateCatalog.version,
      name: contractTemplateCatalog.name,
      description: contractTemplateCatalog.description,
    })
    .from(contractTemplateCatalog)
    .where(eq(contractTemplateCatalog.active, true))
    .orderBy(contractTemplateCatalog.key, desc(contractTemplateCatalog.version));

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

export async function listActiveContractTemplateCatalog(): Promise<CatalogTemplateResponse[]> {
  const rows = await db
    .select()
    .from(contractTemplateCatalog)
    .where(eq(contractTemplateCatalog.active, true))
    .orderBy(asc(contractTemplateCatalog.key), asc(contractTemplateCatalog.version));
  return rows.map(catalogResponse);
}

export async function getActiveContractTemplateCatalog(
  key: string,
  version: number,
): Promise<CatalogTemplateResponse> {
  const [row] = await db
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
  if (!row) throw AppError.notFound("Không tìm thấy mẫu hợp đồng");
  return catalogResponse(row);
}

export async function copyContractTemplateCatalogToMotel(
  motelId: string,
  managerId: string,
  input: { catalogKey: string; catalogVersion: number; name?: string; isDefault?: boolean },
) {
  await resolveOwnedMotel(motelId, managerId);
  if (input.name !== undefined && (!input.name.trim() || input.name.trim().length > 160))
    throw AppError.badRequest("Tên mẫu hợp đồng không hợp lệ");
  return db.transaction(async (tx) => {
    const [catalog] = await tx
      .select()
      .from(contractTemplateCatalog)
      .where(
        and(
          eq(contractTemplateCatalog.key, input.catalogKey),
          eq(contractTemplateCatalog.version, input.catalogVersion),
          eq(contractTemplateCatalog.active, true),
        ),
      )
      .limit(1);
    if (!catalog) throw AppError.notFound("Không tìm thấy mẫu hợp đồng");
    const name = input.name?.trim() || catalog.name;
    if (!name) throw AppError.badRequest("Tên mẫu hợp đồng không được để trống");
    if (catalog.clauses.some((clause) => !clause.title.trim() || !clause.content.trim()))
      throw AppError.badRequest("Mẫu hợp đồng có điều khoản không hợp lệ");
    const clauses = catalog.clauses;
    if (input.isDefault)
      await tx
        .update(contractTemplates)
        .set({ isDefault: false })
        .where(and(eq(contractTemplates.motelId, motelId), eq(contractTemplates.isDefault, true)));
    const [copy] = await tx
      .insert(contractTemplates)
      .values({ motelId, name, clauses, isDefault: input.isDefault ?? false })
      .returning();
    return copy!;
  });
}
