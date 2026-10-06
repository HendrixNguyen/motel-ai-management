import { describe, expect, it } from "vitest";
import { formatPhone } from "@/lib/format/phone";
import { formatCalendarDate } from "@/lib/format/date";

describe("renter contact and calendar dates", () => {
  it.each([["84901234567", "+84 901 234 567"], ["84912345678", "+84 912 345 678"]])("formats %s for human reading without changing the country code", (phone, want) => {
    expect(formatPhone(phone)).toBe(want);
  });
  it("preserves an unexpected phone rather than inventing digits", () => {
    expect(formatPhone("123")).toBe("123");
  });
  it("formats contract calendar days without interpreting them as UTC instants", () => {
    expect(formatCalendarDate("2026-09-01")).toBe("01/09/2026");
    expect(formatCalendarDate("2027-08-31")).toBe("31/08/2027");
  });
});
