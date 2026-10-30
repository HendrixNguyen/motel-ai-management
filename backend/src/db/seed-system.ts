import { sql } from "drizzle-orm";
import { db } from "@/db";
import { seedSystemSuperadmin } from "@/modules/auth/system-superadmin-bootstrap.service";
import { seedContractTemplateCatalog } from "@/modules/contract/contract-catalog.seed";

type SeedSchemaState = {
  managers: boolean | null;
  audit_events: boolean | null;
  catalog: boolean | null;
  contract_status: boolean | null;
  manager_role: boolean | null;
  has_role_col: boolean | null;
  has_disabled_col: boolean | null;
  has_session_col: boolean | null;
};

async function verifySeedSchema() {
  const schema = await db.execute(sql`
    SELECT
      to_regclass('public.managers') IS NOT NULL AS managers,
      to_regclass('public.manager_audit_events') IS NOT NULL AS audit_events,
      to_regclass('public.contract_template_catalog') IS NOT NULL AS catalog,
      to_regtype('public.contract_status') IS NOT NULL AS contract_status,
      to_regtype('public.manager_role') IS NOT NULL AS manager_role,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='managers' AND column_name='role') AS has_role_col,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='managers' AND column_name='disabled_at') AS has_disabled_col,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='managers' AND column_name='session_version') AS has_session_col
  `);
  const state = schema[0] as SeedSchemaState | undefined;
  if (
    !state || state.managers !== true || state.audit_events !== true || state.catalog !== true ||
    state.contract_status !== true || state.manager_role !== true || state.has_role_col !== true ||
    state.has_disabled_col !== true || state.has_session_col !== true
  ) throw new Error("Database schema is incomplete; run and verify the migration job first");
}

const SAFE_SEED_ERRORS = new Map([
  ["System seed requires NODE_ENV=production or staging", "System seed requires NODE_ENV=production or staging"],
  ["Set SUPERADMIN_PASSWORD via a protected secret input (12-256 characters)", "Set SUPERADMIN_PASSWORD via a protected secret input (12-256 characters)"],
  ["Database schema is incomplete; run and verify the migration job first", "Database schema is incomplete; run and verify the migration job first"],
]);

export function systemSeedErrorMessage(error: unknown): string {
  if (error instanceof Error && "safeSystemSeedError" in error && error.safeSystemSeedError === true)
    return error.message;
  return error instanceof Error
    ? SAFE_SEED_ERRORS.get(error.message) ?? "System seed failed; check database schema and connectivity"
    : "System seed failed; check database schema and connectivity";
}

export async function seedSystem(
  env: NodeJS.ProcessEnv = process.env,
  writeSummary: (message: string) => void = (message) => process.stdout.write(message),
): Promise<{ superadminId: string; insertedCatalogKeys: string[] }> {
  if (env.NODE_ENV !== "production" && env.NODE_ENV !== "staging")
    throw new Error("System seed requires NODE_ENV=production or staging");
  const password = env.SUPERADMIN_PASSWORD;
  if (!password || !password.trim() || password.length < 12 || password.length > 256)
    throw new Error("Set SUPERADMIN_PASSWORD via a protected secret input (12-256 characters)");

  await verifySeedSchema();
  const insertedCatalogKeys: string[] = [];
  const superadminId = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('motel-superadmin-bootstrap'))`);
    const id = await seedSystemSuperadmin(tx, password);
    insertedCatalogKeys.push(...(await seedContractTemplateCatalog(tx)));
    return id;
  });
  writeSummary(`System seed complete; catalog entries added: ${insertedCatalogKeys.length}\n`);
  return { superadminId, insertedCatalogKeys };
}

if (import.meta.main) {
  let exitCode = 0;
  try {
    await seedSystem();
  } catch (error) {
    process.stderr.write(`${systemSeedErrorMessage(error)}\n`);
    exitCode = 1;
  }
  try {
    await (await import("./index")).closeDb();
  } catch {
    process.stderr.write("System seed failed; database connection could not be closed safely\n");
    exitCode = 1;
  }
  process.exitCode = exitCode;
}
