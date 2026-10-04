import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/config";
import * as schemas from "./schemas";

/**
 * `bun test` sets `NODE_ENV=test`. Under it the pool must talk to the throwaway
 * database, and this is the only `db` export — an integration test therefore cannot
 * truncate a developer's data by accident, because there is no other client to import.
 * `db/test-db.ts` refuses to reset anything unless both of these hold.
 */
export const isTestRun = process.env.NODE_ENV === "test";

export const connectionString = isTestRun ? env.testDatabaseUrl : env.databaseUrl;

// `DROP SCHEMA ... CASCADE` in the test reset reports every object it removed as a NOTICE.
// They are noise in a test run, so notices are dropped rather than printed.
const client = postgres(connectionString, { max: 10, onnotice: () => {} });

export const db = drizzle(client, { schema: schemas });
export type Db = typeof db;

export async function closeDb(): Promise<void> {
  await client.end();
}