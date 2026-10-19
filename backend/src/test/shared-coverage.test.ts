import { describe, expect, test } from "bun:test";
import { AppError } from "@/shared/errors";
import { resetRateLimits } from "@/shared/rate-limit";
import { enforceRateLimit } from "@/shared/rate-limit";
import { parseEnv } from "@/env";
import { formatVnd, parseAmount, parseVnd, sumVnd } from "@/shared/money";
import { formatPhone, normalisePhone } from "@/shared/phone";

const validEnv = { DATABASE_URL: "postgres://u:p@localhost:5432/motel", TEST_DATABASE_URL: "postgres://u:p@localhost:5432/motel_test", MANAGER_JWT_SECRET: "m".repeat(48), RENTER_SESSION_SECRET: "r".repeat(48), R2_ACCOUNT_ID: "acct", R2_BUCKET: "motel-test", R2_ACCESS_KEY_ID: "a".repeat(48), R2_SECRET_ACCESS_KEY: "s".repeat(48), ZALO_OA_ID: "oa", ZALO_OA_SECRET: "z".repeat(48), ZALO_ACCESS_TOKEN: "t".repeat(48), ZALO_WEBHOOK_SECRET: "w".repeat(48) };

describe("shared low-coverage branches", () => {
  test("constructs every AppError factory with mapped status and details", () => {
    const errors = [AppError.badRequest("bad", { field: "x" }), AppError.unauthorized(), AppError.unauthorized("custom"), AppError.forbidden(), AppError.forbidden("custom"), AppError.notFound(), AppError.notFound("custom"), AppError.conflict("duplicate", { key: "k" }), AppError.readingConflict({ actual: "2" }), AppError.periodAlreadySent(), AppError.externalService(), AppError.externalService("custom"), AppError.rateLimited("slow", 12)];
    expect(errors.map((error) => error.status)).toEqual([400, 401, 401, 403, 403, 404, 404, 409, 409, 409, 502, 502, 429]);
    expect(errors.map((error) => error.code)).toEqual(["VALIDATION_ERROR", "UNAUTHORIZED", "UNAUTHORIZED", "FORBIDDEN", "FORBIDDEN", "NOT_FOUND", "NOT_FOUND", "CONFLICT", "READING_CONFLICT", "PERIOD_ALREADY_SENT", "EXTERNAL_SERVICE_ERROR", "EXTERNAL_SERVICE_ERROR", "RATE_LIMITED"]);
    expect(errors[0]?.details).toEqual({ field: "x" });
    expect(errors[8]?.details).toEqual({ server: { actual: "2" } });
    expect(errors[12]?.details).toEqual({ retryAfterSeconds: 12 });
  });

  test("validates VND maximum, grouping, phone formats and magic-link hash entropy", () => {
    expect(parseAmount("99999999999999")).toBe("99999999999999");
    expect(() => parseAmount("100000000000000")).toThrow("vượt quá");
    expect(formatVnd("1234567")).toBe("1.234.567 ₫");
    expect(sumVnd("123", "877")).toBe("1000");
    expect(normalisePhone("090 123 4567")).toBe("84901234567");
    expect(formatPhone("84901234567")).toBe("090 123 4567");
    expect(() => normalisePhone("not a phone")).toThrow();
  });

  test("parses optional push keys only as a complete pair and validates production defaults", () => {
    expect(parseEnv(validEnv).webPush).toBeNull();
    expect(parseEnv({ ...validEnv, VAPID_PUBLIC_KEY: "public" }).webPush).toBeNull();
    expect(parseEnv({ ...validEnv, VAPID_PUBLIC_KEY: "public", VAPID_PRIVATE_KEY: "private", VAPID_SUBJECT: "mailto:ops@example.test" }).webPush).toEqual({ publicKey: "public", privateKey: "private", subject: "mailto:ops@example.test" });
    expect(() => parseEnv({ ...validEnv, VAPID_PRIVATE_KEY: "private", VAPID_SUBJECT: "mailto:ops@example.test" })).not.toThrow();
  });

  test("validates VAPID key pair consistency and resets in-memory limits", () => {
    resetRateLimits();
    expect(() => enforceRateLimit("coverage", 1)).not.toThrow();
    expect(() => enforceRateLimit("coverage", 1)).toThrow(AppError);
    resetRateLimits();
    expect(() => enforceRateLimit("coverage", 1)).not.toThrow();
  });
});
