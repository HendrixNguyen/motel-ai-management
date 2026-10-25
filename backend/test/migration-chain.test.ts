import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("renter recovery migration drops the legacy token column exactly once", async () => {
  const migration = await readFile(new URL("../drizzle/0025_renter_login_recovery.sql", import.meta.url), "utf8");
  expect(migration.match(/ALTER TABLE magic_links DROP COLUMN token;/g)).toHaveLength(1);
});

test("renter recovery migration relies on dropping token to remove its unique constraint", async () => {
  const migration = await readFile(new URL("../drizzle/0025_renter_login_recovery.sql", import.meta.url), "utf8");
  expect(migration).not.toContain("DROP CONSTRAINT magic_links_token_key");
});
