import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { managerAuditEvents, managers } from "@/modules/auth/auth.schema";
import { seedContractTemplateCatalog as seedCatalog } from "@/modules/contract/contract-catalog.seed";
import { SUPERADMIN_EMAIL, SUPERADMIN_NAME } from "@/modules/auth/superadmin-identity";

async function verifyBootstrapSchema() {
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
  const state = schema[0] as Record<string, boolean> | undefined;
  if (!state || Object.values(state).some((present) => !present))
    throw new Error("Database schema is incomplete; run and verify the migration job first");
}

export { SUPERADMIN_EMAIL };

export async function bootstrapSuperadmin(
  env: NodeJS.ProcessEnv = process.env,
  writeSummary: (message: string) => void = (message) => process.stdout.write(message),
) {
  if (env.NODE_ENV !== "production" && env.NODE_ENV !== "staging")
    throw new Error("Superadmin bootstrap requires NODE_ENV=production");
  if (env.PRODUCTION_SUPERADMIN_CONFIRM?.trim().toLowerCase() !== SUPERADMIN_EMAIL)
    throw new Error(`Set explicit production confirmation to ${SUPERADMIN_EMAIL}`);
  const password = env.SUPERADMIN_PASSWORD;
  if (!password || password.trim().length < 12 || password.length > 256)
    throw new Error("Set SUPERADMIN_PASSWORD via a protected secret input (12-256 characters)");

  await verifyBootstrapSchema();
  const createdCatalogKeys: string[] = [];
  const passwordHash = await Bun.password.hash(password, { algorithm: "argon2id" });
  const rootId = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('motel-superadmin-bootstrap'))`);
    const [existing] = await tx
      .select()
      .from(managers)
      .where(eq(managers.email, SUPERADMIN_EMAIL))
      .for("update")
      .limit(1);
    let superadminId: string;
    if (existing) {
      if (
        existing.role !== "superadmin" ||
        existing.disabledAt ||
        !(await Bun.password.verify(password, existing.passwordHash))
      )
        throw new Error("Superadmin identity conflicts; no data was changed");
      superadminId = existing.id;
    } else {
      const [created] = await tx
        .insert(managers)
        .values({
          email: SUPERADMIN_EMAIL,
          name: SUPERADMIN_NAME,
          passwordHash,
          role: "superadmin",
        })
        .returning({ id: managers.id });
      superadminId = created!.id;
      await tx.insert(managerAuditEvents).values({
        actorId: superadminId,
        targetId: superadminId,
        action: "superadmin.bootstrapped",
      });
    }
    createdCatalogKeys.push(...(await seedCatalog(tx)));
    return superadminId;
  });

  writeSummary(`Superadmin ready; catalog added: ${createdCatalogKeys.length}\n`);
  return { superadminId: rootId, insertedCatalogKeys: createdCatalogKeys };
}

if (import.meta.main) {
  try {
    await bootstrapSuperadmin();
    process.exitCode = 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Superadmin bootstrap failed"}\n`,
    );
    process.exitCode = 1;
  } finally {
    await (await import("./index")).closeDb();
  }
}
