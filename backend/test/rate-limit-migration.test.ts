import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";

setDefaultTimeout(120_000);
const adminUrl = process.env.MIGRATION_TEST_ADMIN_URL ?? process.env.TEST_DATABASE_URL ?? "";
if (!adminUrl)
  throw new Error(
    "MIGRATION_TEST_ADMIN_URL or TEST_DATABASE_URL must point to disposable local PostgreSQL",
  );
const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
const databaseUrl = new URL(adminUrl);
const migration = await readFile(
  new URL("../drizzle/0019_reconcile_rate_limit_buckets.sql", import.meta.url),
  "utf8",
);
const privateCccdMigration = await readFile(
  new URL("../drizzle/0021_private_cccd_metadata.sql", import.meta.url),
  "utf8",
);
const consentMigration = await readFile(
  new URL("../drizzle/0022_contract_consent.sql", import.meta.url),
  "utf8",
);
const pushMigration = await readFile(
  new URL("../drizzle/0023_renter_push_subscriptions.sql", import.meta.url),
  "utf8",
);
const databases: string[] = [];

async function withDatabase(
  run: (sql: ReturnType<typeof postgres>) => Promise<void>,
  migrationSql = migration,
) {
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

async function runMigration(sql: ReturnType<typeof postgres>, source = migration) {
  await sql.unsafe(source);
}

afterAll(async () => {
  const leftovers = await admin`
    SELECT datname FROM pg_database
    WHERE datname LIKE 'migration_%' AND datname = ANY(${databases})
  `;
  for (const row of leftovers)
    await admin.unsafe(`DROP DATABASE IF EXISTS "${row.datname}" WITH (FORCE)`);
  await admin.end();
}, 120_000);

describe("0019 rate-limit bucket reconciliation", () => {
  test("creates current schema on fresh install", async () => {
    await withDatabase(async (sql) => {
      await runMigration(sql);
      const shape =
        await sql`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'public.rate_limit_buckets'::regclass AND contype = 'p'`;
      expect(shape[0]?.definition).toBe("PRIMARY KEY (bucket_key, window_start)");
      const column =
        await sql`SELECT column_default, is_nullable FROM information_schema.columns WHERE table_name = 'rate_limit_buckets' AND column_name = 'request_count'`;
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

  test("adds private manager-only CCCD columns and atomic evidence constraints", async () => {
    await withDatabase(async (sql) => {
      await sql`CREATE TABLE motels (id uuid PRIMARY KEY)`;
      await sql`CREATE TABLE rooms (id uuid PRIMARY KEY)`;
      await sql`CREATE TABLE renters (id uuid PRIMARY KEY, motel_id uuid REFERENCES motels(id), name text, phone text, id_number text, id_card_front_url text, id_card_back_url text, room_id uuid REFERENCES rooms(id), zalo_oa_id text, is_oa_follower boolean, status text, created_at timestamptz)`;
      const motel = randomUUID();
      await sql`CREATE TYPE renter_status AS ENUM ('active','inactive')`;
      await sql`INSERT INTO motels VALUES (${motel})`;
      await sql`INSERT INTO renters (id,motel_id,name,phone,id_card_front_url,id_card_back_url) VALUES (${randomUUID()},${motel},'Historical','84912345678',NULL,NULL)`;
      await runMigration(sql, privateCccdMigration);
      const columns =
        await sql`SELECT column_name FROM information_schema.columns WHERE table_name='renters'`;
      expect(columns.map((row) => row.column_name)).toContain("id_card_front_object_key");
      const history =
        await sql`SELECT legacy_id_card_front_url FROM renters WHERE name='Historical'`;
      expect(history[0]?.legacy_id_card_front_url).toBeNull();
      await sql`INSERT INTO renters (id,motel_id,name,phone,legacy_id_card_front_url) VALUES (${randomUUID()},${motel},'Unsafe','84912345679','https://untrusted/new')`.then(
        () => {
          throw new Error("legacy CCCD CHECK accepted non-null value");
        },
        (error) => {
          expect(String(error)).toContain("renters_legacy_cccd_not_exposed");
        },
      );
      await sql`UPDATE renters SET id_card_front_size = 5000001 WHERE name='Historical'`.then(
        () => {
          throw new Error("CCCD size CHECK accepted oversized value");
        },
        (error) => {
          expect(String(error)).toContain("renters_cccd_front_metadata_check");
        },
      );
    });
  });

  test("adds contract consent evidence columns without requiring historical OTP evidence", async () => {
    await withDatabase(async (sql) => {
      await sql`CREATE TABLE contracts (id uuid PRIMARY KEY, renter_id uuid, room_id uuid, motel_id uuid, template_id uuid, start_date date, end_date date, monthly_rent numeric(14,0), deposit numeric(14,0), clauses jsonb, manager_sent_at timestamptz, otp_sent_at timestamptz, otp_hash text, otp_expires_at timestamptz, otp_attempts numeric(1,0), otp_signed_at timestamptz, status text, created_at timestamptz)`;
      await sql`CREATE TABLE notification_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_key text, renter_id uuid, motel_id uuid, channel text)`;
      await sql`CREATE TYPE notification_event_channel AS ENUM ('zns')`;
      await sql`ALTER TABLE notification_events ALTER COLUMN channel TYPE notification_event_channel USING channel::notification_event_channel`;
      await sql`INSERT INTO contracts VALUES (${randomUUID()},${randomUUID()},${randomUUID()},${randomUUID()},null,'2026-01-01','2026-12-31',1,0,'[]',null,null,null,null,0,null,'active',now())`;
      await runMigration(sql, consentMigration);
      const old = await sql`SELECT accepted_terms_version, consent_method FROM contracts`;
      expect(old[0]?.accepted_terms_version).toBeNull();
      await sql`INSERT INTO contracts (id,accepted_terms_version,consent_method) VALUES (${randomUUID()},'version','session_consent')`.then(
        () => {
          throw new Error("partial consent evidence was accepted");
        },
        (error) => {
          expect(String(error)).toContain("contracts_consent_evidence_complete");
        },
      );
    });
  });

  test("creates push subscriptions with owner foreign keys and unique HTTPS endpoints", async () => {
    await withDatabase(async (sql) => {
      await sql`CREATE TABLE motels (id uuid PRIMARY KEY)`;
      await sql`CREATE TABLE renters (id uuid PRIMARY KEY)`;
      await sql`CREATE TABLE notification_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_key text, renter_id uuid, motel_id uuid, channel text)`;
      await sql`CREATE TYPE notification_event_channel AS ENUM ('zns')`;
      await sql`ALTER TABLE notification_events ALTER COLUMN channel TYPE notification_event_channel USING channel::notification_event_channel`;
      await sql`INSERT INTO motels VALUES (${randomUUID()})`;
      await runMigration(sql, pushMigration);
      const cols =
        await sql`SELECT column_name FROM information_schema.columns WHERE table_name='push_subscriptions'`;
      expect(cols.map((row) => row.column_name)).toContain("p256dh");
      await sql`INSERT INTO push_subscriptions (renter_id,motel_id,endpoint,p256dh,auth) VALUES (${randomUUID()},${randomUUID()},'http://unsafe','p','a')`.then(
        () => {
          throw new Error("insecure push endpoint was accepted");
        },
        (error) => {
          expect(String(error)).toContain("push_subscriptions_https_endpoint");
        },
      );
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
      const rows =
        await sql`SELECT legacy_tag, request_count FROM rate_limit_buckets ORDER BY legacy_tag`;
      expect(rows).toHaveLength(2);
      expect(rows[0]?.legacy_tag).toBe("one");
      expect(rows[0]?.request_count).toBe(3);
      expect(rows[1]?.legacy_tag).toBe("two");
      expect(rows[1]?.request_count).toBe(5);
      const constraints =
        await sql`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'public.rate_limit_buckets'::regclass AND contype = 'p'`;
      expect(constraints[0]?.definition).toBe("PRIMARY KEY (bucket_key, window_start, legacy_tag)");
    });
  });
});
