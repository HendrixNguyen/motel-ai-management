import { describe, expect, test } from "bun:test";
import "../db";
import { enforceLocalRateLimit, resetRateLimits } from "@/shared/rate-limit";
import { parseVnd, parseAmount, formatVnd, sumVnd } from "@/shared/money";

describe("parseVnd", () => {
  test("accepts a digit string and returns it unchanged", () => {
    expect(parseVnd("3850000")).toBe("3850000");
  });
  test("rejects a decimal", () => {
    expect(() => parseVnd("3850000.5")).toThrow();
  });
  test("rejects a negative amount", () => {
    expect(() => parseVnd("-1")).toThrow();
  });
  test("rejects empty, whitespace, padded, and non-ASCII numerals", () => {
    for (const value of ["", " ", "３５", "3 850 000"]) expect(() => parseVnd(value)).toThrow();
    expect(parseVnd(" 1 ")).toBe("1");
  });
  test("rejects a non-numeric string", () => {
    expect(() => parseVnd("3 850 000")).toThrow();
  });
  test("survives a value beyond Number.MAX_SAFE_INTEGER", () => {
    expect(parseVnd("9007199254740993")).toBe("9007199254740993");
  });
});

describe("parseAmount", () => {
  test("normalizes zero and leading zeros within numeric precision", () => {
    expect(parseAmount("0")).toBe("0");
    expect(parseAmount("000999")).toBe("999");
    expect(parseAmount("99999999999999")).toBe("99999999999999");
  });
  test("rejects values beyond numeric precision", () => {
    expect(() => parseAmount("100000000000000")).toThrow(/vượt quá/);
  });
});

describe("formatVnd", () => {
  test("groups thousands with dots", () => {
    expect(formatVnd("3850000")).toBe("3.850.000 ₫");
  });
  test("leaves values under 1000 ungrouped", () => {
    expect(formatVnd("999")).toBe("999 ₫");
  });
  test("groups arbitrary-precision amount", () => {
    expect(formatVnd("9007199254740993")).toBe("9.007.199.254.740.993 ₫");
  });
});

describe("local rate limit bucket behavior", () => {
  test("allows up to limit, rejects the next request, and reports remaining seconds", () => {
    resetRateLimits();
    enforceLocalRateLimit("login:test", 2, 1_000);
    enforceLocalRateLimit("login:test", 2, 2_000);
    let error: unknown;
    try { enforceLocalRateLimit("login:test", 2, 3_000); } catch (cause) { error = cause; }
    expect(error).toMatchObject({ code: "RATE_LIMITED", details: { retryAfterSeconds: 58 } });
  });

  test("resets expired bucket and evicts oldest key when map is full", () => {
    resetRateLimits();
    enforceLocalRateLimit("expired", 1, 0);
    enforceLocalRateLimit("expired", 1, 60_000);
    let error: unknown;
    try { enforceLocalRateLimit("expired", 1, 60_001); } catch (cause) { error = cause; }
    expect(error).toMatchObject({ code: "RATE_LIMITED" });
    resetRateLimits();
    for (let i = 0; i < 10_000; i++) enforceLocalRateLimit(`bucket-${i}`, 2, 100);
    enforceLocalRateLimit("last", 1, 101);
    enforceLocalRateLimit("bucket-0", 1, 102);
    let evictedError: unknown;
    try { enforceLocalRateLimit("bucket-0", 1, 103); } catch (cause) { evictedError = cause; }
    expect(evictedError).toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("sumVnd", () => {
  test("adds large VND integer strings without precision loss", () => {
    expect(sumVnd("9007199254740992", "1")).toBe("9007199254740993");
  });
});
