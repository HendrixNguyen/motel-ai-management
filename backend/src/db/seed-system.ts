import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { managerAuditEvents, managers } from "@/modules/auth/auth.schema";
import { seedContractTemplateCatalog } from "@/modules/contract/contract-catalog.seed";
import { SUPERADMIN_EMAIL, SUPERADMIN_NAME } from "@/modules/auth/superadmin-identity";

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
  const state: unknown = schema[0];
  if (
    !state ||
    typeof state !== "object" ||
    !("managers" in state && state.managers === true) ||
    !("audit_events" in state && state.audit_events === true) ||
    !("catalog" in state && state.catalog === true) ||
    !("contract_status" in state && state.contract_status === true) ||
    !("manager_role" in state && state.manager_role === true) ||
    !("has_role_col" in state && state.has_role_col === true) ||
    !("has_disabled_col" in state && state.has_disabled_col === true) ||
    !("has_session_col" in state && state.has_session_col === true)
  )
    throw new Error("Database schema is incomplete; run and verify the migration job first");
}

export function systemSeedErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    if (message === "System seed requires NODE_ENV=production or staging") return message;
    if (message.startsWith("Set SUPERADMIN_PASSWORD via a protected secret input"))
      return "Set SUPERADMIN_PASSWORD via a protected secret input (12-256 characters)";
    if (message === "Database schema is incomplete; run and verify the migration job first")
      return message;
    if (message === "Canonical Superadmin identity has conflicting role; no data was changed")
      return message;
    if (message === "Canonical Superadmin account is disabled; no data was changed") return message;
    if (message === "Canonical Superadmin password does not match; no data was changed")
      return message;
  }
  return "System seed failed; check database schema and connectivity";
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
    const [existing] = await tx
      .select()
      .from(managers)
      .where(eq(managers.email, SUPERADMIN_EMAIL))
      .for("update")
      .limit(1);
    let id: string;
    if (existing) {
      if (existing.role !== "superadmin")
        throw new Error("Canonical Superadmin identity has conflicting role; no data was changed");
      if (existing.disabledAt)
        throw new Error("Canonical Superadmin account is disabled; no data was changed");
      if (!(await Bun.password.verify(password, existing.passwordHash)))
        throw new Error("Canonical Superadmin password does not match; no data was changed");
      id = existing.id;
    } else {
      const passwordHash = await Bun.password.hash(password, { algorithm: "argon2id" });
      const [created] = await tx
        .insert(managers)
        .values({ email: SUPERADMIN_EMAIL, name: SUPERADMIN_NAME, passwordHash, role: "superadmin" })
        .returning({ id: managers.id });
      id = created!.id;
      await tx.insert(managerAuditEvents).values({
        actorId: id,
        targetId: id,
        action: "superadmin.bootstrapped",
      });
    }
    insertedCatalogKeys.push(...(await seedContractTemplateCatalog(tx)));
    return id;
  });
  writeSummary(`System seed complete; catalog entries added: ${insertedCatalogKeys.length}\n`);
  return { superadminId, insertedCatalogKeys };
}

if (import.meta.main) {
  try {
    await seedSystem();
    process.exitCode = 0;
  } catch (error) {
    process.stderr.write(`${systemSeedErrorMessage(error)}\n`);
    process.exitCode = 1;
  } finally {
    await (await import("./index")).closeDb();
  }
}
