import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, closeDb } from "./index";

/** Resolved from this file so the runner works from any working directory. */
const migrationsFolder = path.join(import.meta.dir, "../../drizzle");

export async function migrateDatabase() {
  await migrate(db, { migrationsFolder });
  console.log(`Applied migrations from ${migrationsFolder}`);
}

if (import.meta.main) {
  await migrateDatabase();
  await closeDb();
}
