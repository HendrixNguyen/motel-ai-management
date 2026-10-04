import { describe, expect, test } from "bun:test";
import { parseVnd, formatVnd, sumVnd } from "@/shared/money";

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
  test("rejects a non-numeric string", () => {
    expect(() => parseVnd("3 850 000")).toThrow();
  });
  test("survives a value beyond Number.MAX_SAFE_INTEGER", () => {
    expect(parseVnd("9007199254740993")).toBe("9007199254740993");
  });
});

describe("formatVnd", () => {
  test("groups thousands with dots", () => {
    expect(formatVnd("3850000")).toBe("3.850.000 ₫");
  });
  test("leaves values under 1000 ungrouped", () => {
    expect(formatVnd("999")).toBe("999 ₫");
  });
});

describe("sumVnd", () => {
  test("adds large VND integer strings without precision loss", () => {
    expect(sumVnd("9007199254740992", "1")).toBe("9007199254740993");
  });
});
