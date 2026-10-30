import { describe, expect, test } from "bun:test";
import { parseEnv } from "@/env";

const valid = {
  DATABASE_URL: "postgres://u:p@localhost:5432/motel",
  TEST_DATABASE_URL: `postgres://u:${"t".repeat(48)}@localhost:5432/motel_test`,
  MANAGER_JWT_SECRET: "a".repeat(48),
  ADMIN_JWT_SECRET: "k".repeat(48),
  RENTER_SESSION_SECRET: "b".repeat(48),
  R2_ACCOUNT_ID: "acct",
  R2_BUCKET: "motel-uploads",
  ZALO_OA_ID: "oa",
  ZALO_OA_SECRET: "z".repeat(48),
  ZALO_ACCESS_TOKEN: "y".repeat(48),
  ZALO_WEBHOOK_SECRET: "x".repeat(48),
  R2_ACCESS_KEY_ID: "r".repeat(48),
  R2_SECRET_ACCESS_KEY: "s".repeat(48),
};

describe("parseEnv", () => {
  test("requires a non-placeholder private R2 bucket", () => {
    expect(() => parseEnv({ ...valid, R2_BUCKET: "" })).toThrow(/R2_BUCKET/);
    expect(() => parseEnv({ ...valid, R2_BUCKET: "public" })).toThrow(/riêng tư/);
  });
  test("accepts a complete environment with postgres rate limits", () => {
    expect(
      parseEnv({
        ...valid,
        NODE_ENV: "production",
        RATE_LIMIT_STORE: "postgres",
        DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
        RENTER_PORTAL_URL: "https://renter.example.com",
        FRONTEND_URL: "https://app.example.com",
      }).rateLimitStore,
    ).toBe("postgres");
  });

  test("covers URL parser failures and every production secret placeholder branch", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      TEST_DATABASE_URL: `postgres://test:${"t".repeat(48)}@db.internal:5432/motel_test_db`,
      RENTER_PORTAL_URL: "https://renter.example.test",
      FRONTEND_URL: "https://app.example.test",
      MANAGER_JWT_SECRET: "a".repeat(48),
      ADMIN_JWT_SECRET: "k".repeat(48),
      RENTER_SESSION_SECRET: "b".repeat(48),
      ZALO_OA_SECRET: "c".repeat(48),
      ZALO_ACCESS_TOKEN: "d".repeat(48),
      ZALO_WEBHOOK_SECRET: "e".repeat(48),
      R2_ACCESS_KEY_ID: "f".repeat(48),
      R2_SECRET_ACCESS_KEY: "g".repeat(48),
    };
    expect(() => parseEnv({ ...valid, RENTER_PORTAL_URL: "not a url" })).toThrow();
    expect(() => parseEnv({ ...production, FRONTEND_URL: "not a url" })).toThrow();
    for (const placeholder of [
      "placeholder-value",
      "change-me-now",
      "secret-value",
      "mock-value",
      "test-value",
      "dev-value",
      "development-value",
      "password-value",
      "super_secret-value",
    ]) {
      expect(() => parseEnv({ ...production, ZALO_ACCESS_TOKEN: placeholder })).toThrow(
        /secret production thực/,
      );
    }
    expect(() => parseEnv({ ...production, R2_PUBLIC_URL: "not a url" })).toThrow(/URL hợp lệ/);
    expect(() => parseEnv({ ...production, DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ ...production, TEST_DATABASE_URL: "" })).toThrow(/TEST_DATABASE_URL/);
  });

  test("rejects local rate limits in production", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "production", RATE_LIMIT_STORE: "local" })).toThrow(
      /RATE_LIMIT_STORE/,
    );
  });

  test("rejects unsupported rate limit stores", () => {
    expect(() => parseEnv({ ...valid, RATE_LIMIT_STORE: "memory" })).toThrow(/RATE_LIMIT_STORE/);
  });

  test("rejects insecure production URLs and localhost database", () => {
    expect(() =>
      parseEnv({
        ...valid,
        NODE_ENV: "production",
        DATABASE_URL: "postgres://u:p@localhost:5432/motel",
        RENTER_PORTAL_URL: "http://portal.example.com",
        FRONTEND_URL: "https://app.example.com",
      }),
    ).toThrow(/DATABASE_URL|HTTPS/);
  });

  test("rejects placeholder or duplicate production secrets", () => {
    expect(() =>
      parseEnv({
        ...valid,
        NODE_ENV: "production",
        DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
        RENTER_PORTAL_URL: "https://renter.example.com",
        FRONTEND_URL: "https://app.example.com",
        MANAGER_JWT_SECRET: "PLACEHOLDER",
      }),
    ).toThrow(/MANAGER_JWT_SECRET/);
    expect(() =>
      parseEnv({
        ...valid,
        NODE_ENV: "production",
        DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
        RENTER_PORTAL_URL: "https://renter.example.com",
        FRONTEND_URL: "https://app.example.com",
        RENTER_SESSION_SECRET: valid.MANAGER_JWT_SECRET,
      }),
    ).toThrow(/secret|trùng/);
    expect(() =>
      parseEnv({
        ...valid,
        NODE_ENV: "production",
        DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
        RENTER_PORTAL_URL: "https://renter.example.com",
        FRONTEND_URL: "https://app.example.com",
        ADMIN_JWT_SECRET: "${ADMIN_JWT_SECRET}",
      }),
    ).toThrow(/ADMIN_JWT_SECRET/);
  });

  test("allows an intentionally weak but distinct production test DB credential", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      TEST_DATABASE_URL: "postgres://test-user:******@postgres:5432/motel_test",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
    };
    expect(() => parseEnv(production)).not.toThrow();
  });

  test("rejects production TEST_DATABASE_URL with compose placeholder credentials", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      TEST_DATABASE_URL: "postgres://DB_USER:DB_PASSWORD@postgres:5432/DB_TEST_NAME",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
    };
    expect(() => parseEnv(production)).toThrow(/TEST_DATABASE_URL/);
  });

  test("throws when DATABASE_URL is missing", () => {
    const { DATABASE_URL, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  test("rejects TEST_DATABASE_URL with unresolved compose variables at production startup", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      TEST_DATABASE_URL: "postgres://DB_USER:DB_PASSWORD@postgres:5432/DB_TEST_NAME",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
    };
    expect(() => parseEnv(production)).toThrow(/TEST_DATABASE_URL/);
  });

  test("trims configured production TEST_DATABASE_URL on output", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      TEST_DATABASE_URL:
        "  postgres://test:separate-password-12345678901234567890@db.internal:5432/test  ",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
    };
    expect(parseEnv(production).testDatabaseUrl).toBe(
      "postgres://test:separate-password-12345678901234567890@db.internal:5432/test",
    );
  });

  test("allows production config without Zalo when its integration is disabled", () => {
    const { ZALO_OA_ID, ZALO_OA_SECRET, ZALO_ACCESS_TOKEN, ZALO_WEBHOOK_SECRET, ...rest } = valid;
    const production = {
      ...rest,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
    };
    const env = parseEnv(production);
    expect(env.zalo.oaId).toBe("");
    expect(env.zalo.oaSecret).toBe("");
  });

  test("rejects empty or placeholder Zalo OA ID when integration is enabled", () => {
    for (const zaloOaId of [" ", "placeholder", "test-oa"]) {
      const production = {
        ...valid,
        NODE_ENV: "production",
        DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
        ZALO_OA_ID: zaloOaId,
        FRONTEND_URL: "https://app.example.com",
        RENTER_PORTAL_URL: "https://renter.example.com",
      };
      expect(() => parseEnv(production)).toThrow();
    }
  });

  test("rejects partial Zalo credentials when an OA id enables the integration", () => {
    const { ZALO_OA_SECRET, ZALO_ACCESS_TOKEN, ZALO_WEBHOOK_SECRET, ...rest } = valid;
    const production = {
      ...rest,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      ZALO_OA_ID: " oa-production ",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
    };
    expect(() => parseEnv(production)).toThrow(/ZALO_OA_SECRET/);
  });

  test("rejects partial Zalo credentials when no OA id enables the integration", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      ZALO_OA_ID: "  ",
      ZALO_OA_SECRET: "",
      ZALO_ACCESS_TOKEN: "partial",
      ZALO_WEBHOOK_SECRET: "",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
    };
    expect(() => parseEnv(production)).toThrow(/configured partially|được cấu hình một phần/);
  });

  test("production Zalo disabled requires no OA secrets and records disabled state", () => {
    const { ZALO_OA_ID, ZALO_OA_SECRET, ZALO_ACCESS_TOKEN, ZALO_WEBHOOK_SECRET, ...rest } = valid;
    const production = {
      ...rest,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
    };
    const env = parseEnv(production);
    expect(env.zalo.enabled).toBe(false);
    expect(env.zalo.oaId).toBe("");
  });

  test("permits production startup without a test database URL", () => {
    const { TEST_DATABASE_URL, ...rest } = valid;
    const production = {
      ...rest,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
    };
    expect(parseEnv(production).testDatabaseUrl).toBe("");
  });

  test("rejects production when test database URL aliases production database, ignoring credentials/options", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel?options=-c%20search_path%3Dproduction",
      TEST_DATABASE_URL:
        "postgres://other:secret@db.internal:5432/motel?options=-c%20search_path%3Dtest",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
    };
    expect(() => parseEnv(production)).toThrow(/TEST_DATABASE_URL/);
  });

  test("rejects malformed percent-encoding in a production test database name", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      TEST_DATABASE_URL:
        "postgres://test:separate-password-12345678901234567890@db.internal:5432/%ZZ",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
    };
    expect(() => parseEnv(production)).toThrow(/encoding không hợp lệ/);
  });

  test("rejects encoded, default-port and case-insensitive aliases of production database URLs", () => {
    const databaseUrl = "postgres://u:p@db.internal:5432/motel";
    for (const testDatabaseUrl of [
      "postgresql://other:secret@db.internal/motel",
      "postgres://other:secret@DB.INTERNAL/motel",
      "postgres://other:secret@db.internal:5432/motel",
      "postgresql://other:secret@db.internal/%6dotel",
    ]) {
      const production = {
        ...valid,
        NODE_ENV: "production",
        DATABASE_URL: databaseUrl,
        TEST_DATABASE_URL: testDatabaseUrl,
        FRONTEND_URL: "https://app.example.com",
        RENTER_PORTAL_URL: "https://renter.example.com",
      };
      expect(() => parseEnv(production)).toThrow(/TEST_DATABASE_URL/);
    }
  });

  test("test mode requires a test database URL", () => {
    const { TEST_DATABASE_URL, ...rest } = valid;
    expect(() => parseEnv({ ...rest, NODE_ENV: "test" })).toThrow(/TEST_DATABASE_URL/);
    expect(() => parseEnv({ ...valid, NODE_ENV: "test", TEST_DATABASE_URL: "" })).toThrow(
      /TEST_DATABASE_URL/,
    );
  });

  test("development can start without a test database URL", () => {
    const { TEST_DATABASE_URL, ...rest } = valid;
    expect(parseEnv({ ...rest, NODE_ENV: "development" }).testDatabaseUrl).toBe("");
  });

  test("rejects malformed password encoding in an explicitly configured production test DB", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      TEST_DATABASE_URL: "postgres://u:bad%ZZ@db.internal:5432/test",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
      ZALO_OA_ID: "oa",
      ZALO_OA_SECRET: "c".repeat(48),
      ZALO_ACCESS_TOKEN: "d".repeat(48),
      ZALO_WEBHOOK_SECRET: "e".repeat(48),
    };
    expect(() => parseEnv(production)).toThrow(/credential encoding không hợp lệ/);
  });

  test("allows weak credentials in an optional non-production test DB in production config", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      TEST_DATABASE_URL: "postgres://u:placeholder@db.internal:5432/motel_test",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
      ZALO_OA_ID: "oa",
      ZALO_OA_SECRET: "c".repeat(48),
      ZALO_ACCESS_TOKEN: "d".repeat(48),
      ZALO_WEBHOOK_SECRET: "e".repeat(48),
    };
    expect(() => parseEnv(production)).not.toThrow();
  });

  test("rejects both supported search_path option encodings when they alias", () => {
    const databaseUrl =
      "postgres://u:p@db.internal:5432/motel?options=-c%20search_path%3Dproduction";
    for (const testDatabaseUrl of [
      databaseUrl,
      "postgres://u:p@db.internal:5432/motel?options=-csearch_path%3Dproduction",
      "postgres://u:p@db.internal:5432/motel?options=-c%3Dsearch_path%3Dproduction",
    ]) {
      const production = {
        ...valid,
        NODE_ENV: "production",
        DATABASE_URL: databaseUrl,
        TEST_DATABASE_URL: testDatabaseUrl,
        FRONTEND_URL: "https://app.example.com",
        RENTER_PORTAL_URL: "https://renter.example.com",
      };
      expect(() => parseEnv(production)).toThrow(/TEST_DATABASE_URL/);
    }
  });

  test("rejects test DB URLs targeting a different search_path on production schema", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel?options=-c%20search_path%3Dproduction",
      TEST_DATABASE_URL:
        "postgres://t:p@db.internal:5432/motel?options=-c%20search_path%3Dproduction",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
    };
    expect(() => parseEnv(production)).toThrow(/TEST_DATABASE_URL/);
  });

  test("rejects whitespace test DB URLs as invalid", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      TEST_DATABASE_URL: "   ",
      FRONTEND_URL: "https://app.example.com",
      RENTER_PORTAL_URL: "https://renter.example.com",
    };
    expect(() => parseEnv(production)).toThrow(/TEST_DATABASE_URL/);
  });

  test("keeps the test database separate from the application database", () => {
    const env = parseEnv(valid);
    expect(env.testDatabaseUrl).not.toBe(env.databaseUrl);
  });

  test("throws when a JWT secret is shorter than 32 characters", () => {
    expect(() => parseEnv({ ...valid, MANAGER_JWT_SECRET: "too-short" })).toThrow(
      /MANAGER_JWT_SECRET/,
    );
  });

  test("reads PORT as a number and defaults to 3000", () => {
    expect(parseEnv({ ...valid, PORT: "8080" }).port).toBe(8080);
    expect(parseEnv(valid).port).toBe(3000);
  });

  test("throws when PORT is not a number", () => {
    expect(() => parseEnv({ ...valid, PORT: "abc" })).toThrow(/PORT/);
  });

  test("rejects insecure production defaults and non-HTTPS public URLs", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      TEST_DATABASE_URL: `postgres://test:${"t".repeat(48)}@db.internal:5432/motel_test_db`,
      RENTER_PORTAL_URL: "https://renter.example.com",
      FRONTEND_URL: "https://app.example.com",
      MANAGER_JWT_SECRET: "a".repeat(48),
      ADMIN_JWT_SECRET: "k".repeat(48),
      RENTER_SESSION_SECRET: "b".repeat(48),
      ZALO_OA_SECRET: "d".repeat(48),
      ZALO_ACCESS_TOKEN: "e".repeat(48),
      ZALO_WEBHOOK_SECRET: "c".repeat(48),
      R2_ACCESS_KEY_ID: "f".repeat(48),
      R2_SECRET_ACCESS_KEY: "g".repeat(48),
    };
    expect(() =>
      parseEnv({ ...production, RENTER_PORTAL_URL: "http://renter.example.com" }),
    ).toThrow(/HTTPS/);
    expect(() => parseEnv({ ...production, ZALO_WEBHOOK_SECRET: "mock_webhook_secret" })).toThrow(
      /secret production/,
    );
  });

  test("rejects duplicate production secrets", () => {
    expect(() =>
      parseEnv({
        ...valid,
        NODE_ENV: "production",
        TEST_DATABASE_URL: `postgres://test:${"t".repeat(48)}@db.internal:5432/motel_test_db`,
        RENTER_PORTAL_URL: "https://renter.example.com",
        FRONTEND_URL: "https://app.example.com",
        MANAGER_JWT_SECRET: "a".repeat(48),
        ADMIN_JWT_SECRET: "a".repeat(48),
        RENTER_SESSION_SECRET: "a".repeat(48),
        ZALO_OA_SECRET: "d".repeat(48),
        ZALO_ACCESS_TOKEN: "e".repeat(48),
        ZALO_WEBHOOK_SECRET: "c".repeat(48),
        R2_ACCESS_KEY_ID: "f".repeat(48),
        R2_SECRET_ACCESS_KEY: "g".repeat(48),
      }),
    ).toThrow(/trùng/);
  });

  test("enables push only when both VAPID keys are configured", () => {
    expect(parseEnv(valid).webPush).toBeNull();
    expect(
      parseEnv({ ...valid, FRONTEND_URL: "https://app.example.test", VAPID_PUBLIC_KEY: "pub" })
        .webPush,
    ).toBeNull();
    expect(
      parseEnv({
        ...valid,
        VAPID_PUBLIC_KEY: "pub",
        VAPID_PRIVATE_KEY: "priv",
        VAPID_SUBJECT: "mailto:ops@example.test",
      }).webPush,
    ).toEqual({ publicKey: "pub", privateKey: "priv", subject: "mailto:ops@example.test" });
  });

  test("exposes ZNS template ids and flags placeholders", () => {
    const env = parseEnv({ ...valid, ZNS_TEMPLATE_BILL: "PLACEHOLDER" });
    expect(env.zalo.templates.bill).toBe("PLACEHOLDER");
  });

  test("requires complete production database URLs", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      TEST_DATABASE_URL: `postgres://test:${"t".repeat(48)}@db.internal:5432/motel_test_db`,
      RENTER_PORTAL_URL: "https://renter.example.com",
      FRONTEND_URL: "https://app.example.com",
      MANAGER_JWT_SECRET: "a".repeat(48),
      ADMIN_JWT_SECRET: "k".repeat(48),
      RENTER_SESSION_SECRET: "b".repeat(48),
      ZALO_OA_SECRET: "d".repeat(48),
      ZALO_ACCESS_TOKEN: "e".repeat(48),
      ZALO_WEBHOOK_SECRET: "c".repeat(48),
      R2_ACCESS_KEY_ID: "f".repeat(48),
      R2_SECRET_ACCESS_KEY: "g".repeat(48),
    };
    const { DATABASE_URL, ...missing } = production;
    expect(() => parseEnv(missing)).toThrow(/DATABASE_URL/);
    expect(
      parseEnv({
        ...production,
        DATABASE_URL: "postgres://user:p%40ss%23@db/motel",
        TEST_DATABASE_URL: `postgres://test:${"t".repeat(48)}@db/test`,
      }).databaseUrl,
    ).toContain("%40");
  });

  test("rejects URL paths consistently", () => {
    expect(() => parseEnv({ ...valid, RENTER_PORTAL_URL: "http://localhost:3000/renter" })).toThrow(
      /path/,
    );
    expect(() => parseEnv({ ...valid, FRONTEND_URL: "http://localhost:3001?next=login" })).toThrow(
      /path/,
    );
  });

  test("requires a proxy assertion pair in production", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.internal:5432/motel",
      TEST_DATABASE_URL: `postgres://test:${"t".repeat(48)}@db.internal:5432/motel_test_db`,
      RENTER_PORTAL_URL: "https://renter.example.com",
      FRONTEND_URL: "https://app.example.com",
      MANAGER_JWT_SECRET: "m".repeat(48),
      ADMIN_JWT_SECRET: "k".repeat(48),
      RENTER_SESSION_SECRET: "n".repeat(48),
      ZALO_OA_SECRET: "o".repeat(48),
      ZALO_ACCESS_TOKEN: "p".repeat(48),
      ZALO_WEBHOOK_SECRET: "q".repeat(48),
      R2_ACCESS_KEY_ID: "r".repeat(48),
      R2_SECRET_ACCESS_KEY: "s".repeat(48),
    };
    expect(() => parseEnv({ ...production, TRUSTED_PROXY_HEADER: "x-forwarded-for" })).toThrow(
      /proxy/i,
    );
    expect(
      parseEnv({
        ...production,
        TRUSTED_PROXY_HEADER: "x-forwarded-for",
        TRUSTED_PROXY_ASSERTION_HEADER: "x-internal-proxy",
        TRUSTED_PROXY_ASSERTION_VALUE: "h".repeat(32),
      }).trustedProxyAssertionValue,
    ).toBe("h".repeat(32));
  });

  test("reads RENTER_PORTAL_URL and FRONTEND_URL defaults", () => {
    expect(parseEnv(valid).renterPortalUrl).toBe("http://localhost:3000");
    expect(parseEnv(valid).frontendUrl).toBe("http://localhost:3001");
    expect(
      parseEnv({
        ...valid,
        RENTER_PORTAL_URL: "https://renter.example.com",
        FRONTEND_URL: "https://app.example.com",
      }),
    ).toMatchObject({
      renterPortalUrl: "https://renter.example.com",
      frontendUrl: "https://app.example.com",
    });
  });
});
