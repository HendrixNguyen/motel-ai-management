import { describe, expect, it } from "vitest";

import { formatVnd, formatVndPlain, parseVndDigits } from "@/lib/format/vnd";

// Every fixture below is a digit string. A float anywhere near money is the habit this module
// exists to prevent, so a fixture that reaches for `3850000` as a number fails review, not just lint.
describe("formatVnd", () => {
  it("groups thousands with a dot and appends the ₫ suffix", () => {
    expect(formatVnd("3850000")).toBe("3.850.000 ₫");
  });

  it("renders the literal example in the spec (room base price)", () => {
    expect(formatVnd("3500000")).toBe("3.500.000 ₫");
  });

  it("renders zero with no separator", () => {
    expect(formatVnd("0")).toBe("0 ₫");
  });

  it("groups a four-digit amount once", () => {
    expect(formatVnd("9999")).toBe("9.999 ₫");
  });

  it("renders the largest amount numeric(14,0) holds", () => {
    expect(formatVnd("99999999999999")).toBe("99.999.999.999.999 ₫");
  });

  it("groups a value past Number.MAX_SAFE_INTEGER exactly, which Number cannot", () => {
    // 2^53 + 1. Any implementation that reaches for `Number(input)` or `Intl.NumberFormat`
    // prints ...992 here, so this is the assertion that makes "never Number" testable.
    expect(Number("9007199254740993")).toBe(9007199254740992);
    expect(formatVnd("9007199254740993")).toBe("9.007.199.254.740.993 ₫");
  });

  it("separates the amount from ₫ with U+0020, not a non-breaking space", () => {
    // Pinned because `frontend-ui-specs.md` demands money never wraps: later components owe
    // `whitespace-nowrap` (and `tabular-nums`) on any element holding this string. A silent
    // U+00A0 here would make that rule true by accident for some elements and unmet for others.
    expect(formatVnd("1000")).toBe("1.000 \u20AB");
    expect(formatVnd("1000")).not.toContain("\u00a0");
  });
});

describe("formatVndPlain", () => {
  it("groups the digits and omits the currency suffix for an editable field", () => {
    expect(formatVndPlain("3500000")).toBe("3.500.000");
  });

  it("renders zero ungrouped", () => {
    expect(formatVndPlain("0")).toBe("0");
  });

  it("groups a value past Number.MAX_SAFE_INTEGER exactly", () => {
    expect(formatVndPlain("9007199254740993")).toBe("9.007.199.254.740.993");
  });

  it("round-trips through parseVndDigits, so a field holding it can be read back", () => {
    const digits = "99999999999999";
    expect(parseVndDigits(formatVndPlain(digits))).toBe(digits);
  });

  it("does not read back what formatVnd writes — a field must hold the plain form", () => {
    // Named because it is a trap for the first editable field: pre-filling an input with
    // `3.500.000 ₫` makes every submit of it fail validation.
    expect(parseVndDigits(formatVnd("3500000"))).toBeNull();
  });
});

describe("parseVndDigits", () => {
  it("strips the dot separators of a grouped amount", () => {
    expect(parseVndDigits("3.500.000")).toBe("3500000");
  });

  it("strips spaces, so a pasted grouped amount is accepted", () => {
    expect(parseVndDigits("3 500 000")).toBe("3500000");
    expect(parseVndDigits(" 3500000 ")).toBe("3500000");
  });

  it("passes an already-plain digit string through", () => {
    expect(parseVndDigits("3500000")).toBe("3500000");
  });

  it("normalises leading zeros, the way the backend's BigInt gate does", () => {
    expect(parseVndDigits("007")).toBe("7");
    expect(parseVndDigits("0")).toBe("0");
    expect(parseVndDigits("000")).toBe("0");
  });

  it("accepts the largest amount numeric(14,0) holds", () => {
    expect(parseVndDigits("99.999.999.999.999")).toBe("99999999999999");
  });

  it("rejects letters", () => {
    expect(parseVndDigits("abc")).toBeNull();
  });

  it("rejects digits mixed with anything else", () => {
    expect(parseVndDigits("12a")).toBeNull();
    expect(parseVndDigits("1e6")).toBeNull();
    expect(parseVndDigits("-1000")).toBeNull();
    expect(parseVndDigits("3,500,000")).toBeNull();
    expect(parseVndDigits("1000₫")).toBeNull();
  });

  it("rejects an input with no digits left once separators are stripped", () => {
    expect(parseVndDigits("")).toBeNull();
    expect(parseVndDigits("   ")).toBeNull();
    expect(parseVndDigits(".")).toBeNull();
  });

  it("treats any dot as a separator, per the strip rule in the brief", () => {
    // Pinned, not endorsed: "1.5" is 15 under the strip rule, so an input field must never hand
    // parseVndDigits half-typed text ("1." or "3.5000") and reformat on every keystroke.
    expect(parseVndDigits("1.5")).toBe("15");
  });
});
