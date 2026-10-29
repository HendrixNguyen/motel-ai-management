import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { managerAuditEvents, managers } from "@/modules/auth/auth.schema";
import { seedContractTemplateCatalog as seedCatalog } from "@/modules/contract/contract-catalog.seed";
import { SUPERADMIN_EMAIL, SUPERADMIN_NAME } from "@/modules/auth/superadmin-identity";


const REQUIRED_SCHEMA_MIGRATIONS = [
  "0028_manager_admin",
] as const;

async function verifyBootstrapSchema() {
  const journalPath = new URL("../../drizzle/meta/_journal.json", import.meta.url);
  const journal = JSON.parse(await Bun.file(journalPath).text()) as {
    entries: { tag: string }[];
  };
  const entriesByTag = new Map(journal.entries.map((entry) => [entry.tag, entry]));
  const pending = REQUIRED_SCHEMA_MIGRATIONS.filter((tag) => !entriesByTag.has(tag));
  if (pending.length) throw new Error(`Required migration ${pending[0]} is absent from release journal`);
  const recordedLedger = await db.execute(sql`SELECT id, hash FROM drizzle.__drizzle_migrations`);
  const byId = new Map(recordedLedger.map((row) => [Number((row as { id: number }).id), String((row as { hash: string }).hash)]));
  const expectedHashes = await Promise.all(REQUIRED_SCHEMA_MIGRATIONS.map(async (tag) => {
    const migration = Bun.file(new URL(`../../drizzle/${tag}.sql`, import.meta.url));
    if (!(await migration.exists())) throw new Error(`Required migration ${tag} is absent from this release`);
    return new Bun.CryptoHasher("sha256").update(await migration.text()).digest("hex");
  }));
  for (const tag of REQUIRED_SCHEMA_MIGRATIONS) {
    const index = journal.entries.findIndex((entry) => entry.tag === tag);
    const migrationId = index + 1;
    if (byId.get(migrationId) !== expectedHashes[REQUIRED_SCHEMA_MIGRATIONS.indexOf(tag)])
      throw new Error(`Required schema migration ${tag} is not applied; run and verify the migration job first`);
  }
  const schema = await db.execute(sql`
    SELECT
      to_regclass('public.managers') IS NOT NULL AS managers,
      to_regclass('public.manager_audit_events') IS NOT NULL AS audit_events,
      to_regclass('public.contract_template_catalog') IS NOT NULL AS catalog,
      to_regtype('public.contract_status') IS NOT NULL AS contract_status,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='managers' AND column_name='role') AS manager_role
  `);
  const state = schema[0] as Record<string, boolean> | undefined;
  if (!state || Object.values(state).some((present) => !present)) throw new Error("Database schema is incomplete; run and verify the migration job first");
}

export { SUPERADMIN_EMAIL };

export async function bootstrapSuperadmin(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production") throw new Error("Superadmin bootstrap requires NODE_ENV=production");
  if (env.PRODUCTION_SUPERADMIN_CONFIRM?.trim().toLowerCase() !== SUPERADMIN_EMAIL) throw new Error(`Set explicit production confirmation to ${SUPERADMIN_EMAIL}`);
  const password = env.SUPERADMIN_PASSWORD;
  if (!password || password.trim().length < 12 || password.length > 256) throw new Error("Set SUPERADMIN_PASSWORD via a protected secret input (12-256 characters)");

  await verifyBootstrapSchema();
  const createdCatalogKeys: string[] = [];
  const passwordHash = await Bun.password.hash(password, { algorithm: "argon2id" });
  const rootId = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('motel-superadmin-bootstrap'))`);
    const [existing] = await tx.select().from(managers).where(eq(managers.email, SUPERADMIN_EMAIL)).for("update").limit(1);
    let superadminId: string;
    if (existing) {
      if (existing.role !== "superadmin" || existing.disabledAt || !(await Bun.password.verify(password, existing.passwordHash)))
        throw new Error("Superadmin identity conflicts; no data was changed");
      superadminId = existing.id;
    } else {
      const [created] = await tx.insert(managers).values({ email: SUPERADMIN_EMAIL, name: SUPERADMIN_NAME, passwordHash, role: "superadmin" }).returning({ id: managers.id });
      superadminId = created!.id;
      await tx.insert(managerAuditEvents).values({ actorId: superadminId, targetId: superadminId, action: "superadmin.bootstrapped" });
    }
    createdCatalogKeys.push(...await seedCatalog(tx));
    return superadminId;
  });

  process.stdout.write(`Superadmin ready (${rootId}); catalog added: ${createdCatalogKeys.length}\n`);
  return { superadminId: rootId, insertedCatalogKeys: createdCatalogKeys };
}

if (import.meta.main) {
  try {
    await bootstrapSuperadmin();
    process.exitCode = 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Superadmin bootstrap failed"}\n`);
    process.exitCode = 1;
  } finally {
    await (await import("./index")).closeDb();
  }
}
