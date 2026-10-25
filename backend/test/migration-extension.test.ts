import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("renter login recovery migration enables pgcrypto before generating access codes", async () => {
  const migration = await readFile(new URL("../drizzle/0025_renter_login_recovery.sql", import.meta.url), "utf8");
  expect(migration.indexOf("CREATE EXTENSION IF NOT EXISTS pgcrypto")).toBeGreaterThanOrEqual(0);
  expect(migration.indexOf("CREATE EXTENSION IF NOT EXISTS pgcrypto")).toBeLessThan(migration.indexOf("gen_random_bytes"));
});
