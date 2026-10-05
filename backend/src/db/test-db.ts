import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { env } from "@/config";
import { connectionString, db, isTestRun } from "./index";

const migrationsFolder = path.join(import.meta.dir, "../../drizzle");

const TABLES = [
  "zalo_notifications",
  "magic_links",
  "help_tickets",
  "invoices",
  "meter_readings",
  "billing_periods",
  "contracts",
  "contract_templates",
  "renters",
  "rooms",
  "motels",
  "managers",
];

/**
 * Rebuilds the test database from scratch: drop the schema, re-apply every migration,
 * then truncate.
 *
 * Re-applying the migrations is what keeps this honest — a test always runs against the
 * current migration set, so a constraint added since the last run is enforced instead of
 * silently missing. Truncating afterwards is the belt to that braces: no row survives.
 *
 * The `drizzle` schema goes too: it holds `__drizzle_migrations`, and leaving it behind
 * makes the migrator believe every migration is already applied.
 *
 * Throws unless the pool is provably pointed at `TEST_DATABASE_URL`. This function
 * destroys a schema, and a developer's real database must not be reachable from here.
 */
export async function resetDb(): Promise<void> {
  if (!isTestRun)
    throw new Error(
      `resetDb() refused: NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, expected "test".`,
    );
  if (connectionString !== env.testDatabaseUrl)
    throw new Error("resetDb() refused: the pool is not pointed at TEST_DATABASE_URL.");

  await db.execute(
    sql.raw("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public; CREATE SCHEMA drizzle;"),
  );
  await migrate(db, { migrationsFolder });
  await db.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`));
}