import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/config";
import { connectionString, isTestRun } from "./index";

const migrationsFolder = path.join(import.meta.dir, "../../drizzle");

const TABLES = [
  "uploads",
  "notification_webhook_events",
  "notification_events",
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
  if (process.env.SKIP_DB_RESET === "1") return;
  if (!isTestRun)
    throw new Error(
      `resetDb() refused: NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, expected "test".`,
    );
  if (connectionString !== env.testDatabaseUrl)
    throw new Error("resetDb() refused: the pool is not pointed at TEST_DATABASE_URL.");

  // Use a dedicated single connection for the reset to avoid connection pool issues
  const client = postgres(env.testDatabaseUrl, { max: 1, onnotice: () => {} });
  const resetDb = drizzle(client);

  try {
    await client.unsafe("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'motel_test' AND pid <> pg_backend_pid()");
    await resetDb.execute(sql.raw("DROP SCHEMA IF EXISTS public CASCADE"));
    await resetDb.execute(sql.raw("DROP SCHEMA IF EXISTS drizzle CASCADE"));
    await resetDb.execute(sql.raw("CREATE SCHEMA public"));
    await resetDb.execute(sql.raw("CREATE SCHEMA drizzle"));
    await resetDb.execute(sql.raw("SET search_path TO public, drizzle"));
    await migrate(resetDb, { migrationsFolder });
    await resetDb.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`));
  } finally {
    await client.end();
  }
}