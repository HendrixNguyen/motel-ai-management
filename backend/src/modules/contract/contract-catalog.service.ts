import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { contractTemplateCatalog, contractTemplates } from "./contract.schema";
import { resolveOwnedMotel } from "@/middleware/tenancy";
import { AppError } from "@/shared/errors";

export type CatalogTemplateResponse = {
  id: string;
  key: string;
  version: number;
  name: string;
  description: string;
  clauses: { title: string; content: string }[];
};

function catalogResponse(row: typeof contractTemplateCatalog.$inferSelect): CatalogTemplateResponse {
  if (!Array.isArray(row.clauses) || row.clauses.some((clause) => !clause || typeof clause.title !== "string" || typeof clause.content !== "string" || !clause.title.trim() || !clause.content.trim()))
    throw AppError.badRequest("Mẫu hợp đồng có điều khoản không hợp lệ");
  return { id: row.id, key: row.key, version: row.version, name: row.name, description: row.description, clauses: row.clauses };
}

export async function listActiveContractTemplateCatalog(): Promise<CatalogTemplateResponse[]> {
  const rows = await db.select().from(contractTemplateCatalog).where(eq(contractTemplateCatalog.active, true)).orderBy(asc(contractTemplateCatalog.key), asc(contractTemplateCatalog.version));
  return rows.map(catalogResponse);
}

export async function getActiveContractTemplateCatalog(key: string, version: number): Promise<CatalogTemplateResponse> {
  const [row] = await db.select().from(contractTemplateCatalog).where(and(eq(contractTemplateCatalog.key, key), eq(contractTemplateCatalog.version, version), eq(contractTemplateCatalog.active, true))).limit(1);
  if (!row) throw AppError.notFound("Không tìm thấy mẫu hợp đồng");
  return catalogResponse(row);
}

export async function copyContractTemplateCatalogToMotel(
  motelId: string,
  managerId: string,
  input: { catalogKey: string; catalogVersion: number; name?: string; isDefault?: boolean },
) {
  await resolveOwnedMotel(motelId, managerId);
  if (input.name !== undefined && (!input.name.trim() || input.name.trim().length > 160)) throw AppError.badRequest("Tên mẫu hợp đồng không hợp lệ");
  return db.transaction(async (tx) => {
    const [catalog] = await tx.select().from(contractTemplateCatalog).where(and(
      eq(contractTemplateCatalog.key, input.catalogKey),
      eq(contractTemplateCatalog.version, input.catalogVersion),
      eq(contractTemplateCatalog.active, true),
    )).limit(1);
    if (!catalog) throw AppError.notFound("Không tìm thấy mẫu hợp đồng");
    const name = input.name?.trim() || catalog.name;
    if (!name) throw AppError.badRequest("Tên mẫu hợp đồng không được để trống");
    if (catalog.clauses.some((clause) => !clause.title.trim() || !clause.content.trim())) throw AppError.badRequest("Mẫu hợp đồng có điều khoản không hợp lệ");
    const clauses = catalog.clauses;
    if (input.isDefault) await tx.update(contractTemplates).set({ isDefault: false }).where(and(eq(contractTemplates.motelId, motelId), eq(contractTemplates.isDefault, true)));
    const [copy] = await tx.insert(contractTemplates).values({ motelId, name, clauses, isDefault: input.isDefault ?? false }).returning();
    return copy!;
  });
}
