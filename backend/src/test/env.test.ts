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
    expect(parseEnv({ ...valid, NODE_ENV: "production", RATE_LIMIT_STORE: "postgres" }).rateLimitStore).toBe("postgres");
  });

  test("rejects local rate limits in production", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "production", RATE_LIMIT_STORE: "local" })).toThrow(/RATE_LIMIT_STORE/);
  });

  test("rejects unsupported rate limit stores", () => {
    expect(() => parseEnv({ ...valid, RATE_LIMIT_STORE: "memory" })).toThrow(/RATE_LIMIT_STORE/);
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

  test("exposes ZNS template ids and flags placeholders", () => {
    const env = parseEnv({ ...valid, ZNS_TEMPLATE_BILL: "PLACEHOLDER" });
    expect(env.zalo.templates.bill).toBe("PLACEHOLDER");
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
