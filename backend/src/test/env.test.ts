import { describe, expect, test } from "bun:test";
import { parseEnv } from "@/env";

const valid = {
  DATABASE_URL: "postgres://u:p@localhost:5432/motel",
  TEST_DATABASE_URL: "postgres://u:p@localhost:5432/motel_test",
  MANAGER_JWT_SECRET: "a".repeat(48),
  RENTER_SESSION_SECRET: "b".repeat(48),
  R2_ACCOUNT_ID: "acct",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  ZALO_OA_ID: "oa",
  ZALO_OA_SECRET: "oa-secret",
  ZALO_ACCESS_TOKEN: "token",
  ZALO_WEBHOOK_SECRET: "hook",
};

describe("parseEnv", () => {
  test("accepts a complete environment with postgres rate limits", () => {
    expect(parseEnv({ ...valid, NODE_ENV: "production", RATE_LIMIT_STORE: "postgres", DATABASE_URL: "postgres://u:p@db.internal:5432/motel", RENTER_PORTAL_URL: "https://renter.example.com", FRONTEND_URL: "https://app.example.com" }).rateLimitStore).toBe("postgres");
  });

  test("rejects local rate limits in production", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "production", RATE_LIMIT_STORE: "local" })).toThrow(/RATE_LIMIT_STORE/);
  });

  test("rejects unsupported rate limit stores", () => {
    expect(() => parseEnv({ ...valid, RATE_LIMIT_STORE: "memory" })).toThrow(/RATE_LIMIT_STORE/);
  });

  test("rejects insecure production URLs and localhost database", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "production", DATABASE_URL: "postgres://u:p@localhost:5432/motel", RENTER_PORTAL_URL: "http://portal.example.com", FRONTEND_URL: "https://app.example.com" })).toThrow(/DATABASE_URL|HTTPS/);
  });

  test("rejects placeholder or duplicate production secrets", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "production", DATABASE_URL: "postgres://u:p@db.internal:5432/motel", RENTER_PORTAL_URL: "https://renter.example.com", FRONTEND_URL: "https://app.example.com", MANAGER_JWT_SECRET: "PLACEHOLDER" })).toThrow(/MANAGER_JWT_SECRET/);
    expect(() => parseEnv({ ...valid, NODE_ENV: "production", DATABASE_URL: "postgres://u:p@db.internal:5432/motel", RENTER_PORTAL_URL: "https://renter.example.com", FRONTEND_URL: "https://app.example.com", RENTER_SESSION_SECRET: valid.MANAGER_JWT_SECRET })).toThrow(/secret/);
  });

  test("throws when DATABASE_URL is missing", () => {
    const { DATABASE_URL, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  test("throws when TEST_DATABASE_URL is missing", () => {
    const { TEST_DATABASE_URL, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(/TEST_DATABASE_URL/);
  });

  test("keeps the test database separate from the application database", () => {
    const env = parseEnv(valid);
    expect(env.testDatabaseUrl).not.toBe(env.databaseUrl);
  });

  test("throws when a JWT secret is shorter than 32 characters", () => {
    expect(() =>
      parseEnv({ ...valid, MANAGER_JWT_SECRET: "too-short" }),
    ).toThrow(/MANAGER_JWT_SECRET/);
  });

  test("reads PORT as a number and defaults to 3000", () => {
    expect(parseEnv({ ...valid, PORT: "8080" }).port).toBe(8080);
    expect(parseEnv(valid).port).toBe(3000);
  });

  test("throws when PORT is not a number", () => {
    expect(() => parseEnv({ ...valid, PORT: "abc" })).toThrow(/PORT/);
  });

  test("rejects insecure production defaults and non-HTTPS public URLs", () => {
    const production = { ...valid, NODE_ENV: "production", RENTER_PORTAL_URL: "https://renter.example.com", FRONTEND_URL: "https://app.example.com", MANAGER_JWT_SECRET: "a".repeat(48), RENTER_SESSION_SECRET: "b".repeat(48), ZALO_OA_SECRET: "d".repeat(48), ZALO_ACCESS_TOKEN: "e".repeat(48), ZALO_WEBHOOK_SECRET: "c".repeat(48), R2_ACCESS_KEY_ID: "f".repeat(48), R2_SECRET_ACCESS_KEY: "g".repeat(48) };
    expect(() => parseEnv({ ...production, RENTER_PORTAL_URL: "http://renter.example.com" })).toThrow(/HTTPS/);
    expect(() => parseEnv({ ...production, ZALO_WEBHOOK_SECRET: "mock_webhook_secret" })).toThrow(/secret production/);
  });

  test("rejects duplicate production secrets", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "production", RENTER_PORTAL_URL: "https://renter.example.com", FRONTEND_URL: "https://app.example.com", MANAGER_JWT_SECRET: "a".repeat(48), RENTER_SESSION_SECRET: "a".repeat(48), ZALO_OA_SECRET: "d".repeat(48), ZALO_ACCESS_TOKEN: "e".repeat(48), ZALO_WEBHOOK_SECRET: "c".repeat(48), R2_ACCESS_KEY_ID: "f".repeat(48), R2_SECRET_ACCESS_KEY: "g".repeat(48) })).toThrow(/trùng/);
  });

  test("exposes ZNS template ids and flags placeholders", () => {
    const env = parseEnv({ ...valid, ZNS_TEMPLATE_BILL: "PLACEHOLDER" });
    expect(env.zalo.templates.bill).toBe("PLACEHOLDER");
  });

  test("requires complete production database URLs", () => {
    const production = { ...valid, NODE_ENV: "production", RENTER_PORTAL_URL: "https://renter.example.com", FRONTEND_URL: "https://app.example.com", MANAGER_JWT_SECRET: "a".repeat(48), RENTER_SESSION_SECRET: "b".repeat(48), ZALO_OA_SECRET: "d".repeat(48), ZALO_ACCESS_TOKEN: "e".repeat(48), ZALO_WEBHOOK_SECRET: "c".repeat(48), R2_ACCESS_KEY_ID: "f".repeat(48), R2_SECRET_ACCESS_KEY: "g".repeat(48) };
    const { DATABASE_URL, ...missing } = production;
    expect(() => parseEnv(missing)).toThrow(/DATABASE_URL/);
    expect(parseEnv({ ...production, DATABASE_URL: "postgres://user:p%40ss%23@db/motel", TEST_DATABASE_URL: "postgres://test:p%40ss%23@db/test" }).databaseUrl).toContain("%40");
  });

  test("rejects URL paths consistently", () => {
    expect(() => parseEnv({ ...valid, RENTER_PORTAL_URL: "http://localhost:3000/renter" })).toThrow(/path/);
    expect(() => parseEnv({ ...valid, FRONTEND_URL: "http://localhost:3001?next=login" })).toThrow(/path/);
  });

  test("requires a proxy assertion pair in production", () => {
    const production = { ...valid, NODE_ENV: "production", RENTER_PORTAL_URL: "https://renter.example.com", FRONTEND_URL: "https://app.example.com", MANAGER_JWT_SECRET: "a".repeat(48), RENTER_SESSION_SECRET: "b".repeat(48), ZALO_OA_SECRET: "d".repeat(48), ZALO_ACCESS_TOKEN: "e".repeat(48), ZALO_WEBHOOK_SECRET: "c".repeat(48), R2_ACCESS_KEY_ID: "f".repeat(48), R2_SECRET_ACCESS_KEY: "g".repeat(48) };
    expect(() => parseEnv({ ...production, TRUSTED_PROXY_HEADER: "x-forwarded-for" })).toThrow(/proxy/i);
    expect(parseEnv({ ...production, TRUSTED_PROXY_HEADER: "x-forwarded-for", TRUSTED_PROXY_ASSERTION_HEADER: "x-internal-proxy", TRUSTED_PROXY_ASSERTION_VALUE: "h".repeat(32) }).trustedProxyAssertionValue).toBe("h".repeat(32));
  });

  test("reads RENTER_PORTAL_URL and FRONTEND_URL defaults", () => {
    expect(parseEnv(valid).renterPortalUrl).toBe("http://localhost:3000");
    expect(parseEnv(valid).frontendUrl).toBe("http://localhost:3001");
    expect(parseEnv({ ...valid, RENTER_PORTAL_URL: "https://renter.example.com", FRONTEND_URL: "https://app.example.com" })).toMatchObject({
      renterPortalUrl: "https://renter.example.com",
      frontendUrl: "https://app.example.com",
    });
  });
});
