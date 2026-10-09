import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, test } from "bun:test";

const adminUrl = process.env.MIGRATION_TEST_ADMIN_URL ?? "";
if (!adminUrl) throw new Error("MIGRATION_TEST_ADMIN_URL must point to disposable local PostgreSQL");
const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
const databaseUrl = new URL(adminUrl);
const migration = await readFile(new URL("../../drizzle/0019_reconcile_rate_limit_buckets.sql", import.meta.url), "utf8");
const databases: string[] = [];

async function withDatabase(run: (sql: ReturnType<typeof postgres>) => Promise<void>) {
  const name = `migration_${randomUUID().replaceAll("-", "")}`;
  await admin.unsafe(`CREATE DATABASE "${name}"`);
  databases.push(name);
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
  try {
    await run(sql);
  } finally {
    await sql.end();
  }
}

async function runMigration(sql: ReturnType<typeof postgres>) {
  await sql.unsafe(migration);
}

afterAll(async () => {
  for (const name of databases) await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.end();
});

describe("0019 rate-limit bucket reconciliation", () => {
  test("creates current schema on fresh install", async () => {
    await withDatabase(async (sql) => {
      await runMigration(sql);
      const shape = await sql`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'public.rate_limit_buckets'::regclass AND contype = 'p'`;
      expect(shape[0]?.definition).toBe("PRIMARY KEY (bucket_key, window_start)");
      const column = await sql`SELECT column_default, is_nullable FROM information_schema.columns WHERE table_name = 'rate_limit_buckets' AND column_name = 'request_count'`;
      expect(column[0]?.column_default).toBe("0");
      expect(column[0]?.is_nullable).toBe("NO");
    });
  });

  test("upgrades verified key-primary-key legacy shape without losing row", async () => {
    await withDatabase(async (sql) => {
      await sql`CREATE TABLE rate_limit_buckets (key text PRIMARY KEY, window_started_at timestamptz NOT NULL, count integer NOT NULL CHECK (count > 0))`;
      await sql`INSERT INTO rate_limit_buckets VALUES ('legacy', '2026-01-01T00:00:00Z', 7)`;
      await runMigration(sql);
      const rows = await sql`SELECT bucket_key, request_count FROM rate_limit_buckets`;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.bucket_key).toBe("legacy");
      expect(rows[0]?.request_count).toBe(7);
    });
  });

  test("accepts verified composite-primary-key current shape", async () => {
    await withDatabase(async (sql) => {
      await sql`CREATE TABLE rate_limit_buckets (bucket_key text NOT NULL, window_start timestamptz NOT NULL, request_count integer NOT NULL DEFAULT 0, PRIMARY KEY (bucket_key, window_start))`;
      await sql`INSERT INTO rate_limit_buckets VALUES ('current', '2026-01-01T00:00:00Z', 4)`;
      await runMigration(sql);
      const rows = await sql`SELECT bucket_key, request_count FROM rate_limit_buckets`;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.bucket_key).toBe("current");
      expect(rows[0]?.request_count).toBe(4);
    });
  });

  test("aborts alternate composite-column shape before altering constraints or rows", async () => {
    await withDatabase(async (sql) => {
      await sql`CREATE TABLE rate_limit_buckets (bucket_key text NOT NULL, window_start timestamptz NOT NULL, request_count integer NOT NULL, legacy_tag text NOT NULL, PRIMARY KEY (bucket_key, window_start, legacy_tag))`;
      await sql`INSERT INTO rate_limit_buckets VALUES ('duplicate', '2026-01-01T00:00:00Z', 3, 'one'), ('duplicate', '2026-01-01T00:00:00Z', 5, 'two')`;
      let error: unknown;
      try {
        await runMigration(sql);
      } catch (caught) {
        error = caught;
      }
      expect(String(error)).toMatch(/unrecognized.*primary key|unsupported.*schema|refusing/i);
      const rows = await sql`SELECT legacy_tag, request_count FROM rate_limit_buckets ORDER BY legacy_tag`;
      expect(rows).toHaveLength(2);
      expect(rows[0]?.legacy_tag).toBe("one");
      expect(rows[0]?.request_count).toBe(3);
      expect(rows[1]?.legacy_tag).toBe("two");
      expect(rows[1]?.request_count).toBe(5);
      const constraints = await sql`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'public.rate_limit_buckets'::regclass AND contype = 'p'`;
      expect(constraints[0]?.definition).toBe("PRIMARY KEY (bucket_key, window_start, legacy_tag)");
    });
  });
});
