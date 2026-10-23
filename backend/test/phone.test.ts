import { describe, expect, test } from "bun:test";
import { normalisePhone, formatPhone } from "@/shared/phone";

describe("normalisePhone", () => {
  test("strips a leading zero", () => {
    expect(normalisePhone("0901234567")).toBe("84901234567");
  });
  test("strips a leading plus", () => {
    expect(normalisePhone("+84901234567")).toBe("84901234567");
  });
  test("strips spaces and dashes", () => {
    expect(normalisePhone("090 123-4567")).toBe("84901234567");
  });
  test("rejects a 9-digit number", () => {
    expect(() => normalisePhone("901234567")).toThrow();
  });
  test("rejects letters", () => {
    expect(() => normalisePhone("09a1234567")).toThrow();
  });
});

describe("formatPhone", () => {
  test("groups a mobile number for display", () => {
    expect(formatPhone("84901234567")).toBe("090 123 4567");
  });
});
