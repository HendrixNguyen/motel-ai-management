import { describe, expect, it } from "vitest";

import { formatDate, formatMonth } from "@/lib/format/date";

// Vietnam is UTC+7 with no daylight saving, so an instant late in the UTC day is already the
// next day for the manager reading it. Every boundary case below is written so that a UTC-based
// implementation — the natural mistake, since `Date` speaks UTC — answers with a different day.
describe("formatDate", () => {
  it("renders DD/MM/YYYY", () => {
    expect(formatDate("2026-03-15T02:00:00.000Z")).toBe("15/03/2026");
  });

  it("zero-pads a day and a month that are each one digit", () => {
    // One fixture with single digits in both positions, so relaxing `2-digit` to `numeric` cannot
    // pass on a day or a month that happened to land on two digits.
    expect(formatDate("2026-06-09T02:00:00.000Z")).toBe("09/06/2026");
  });

  it("reads the same day as its own parts rather than reordering them", () => {
    // 9 June, not 6 September: if the assembly order drifted to the locale's, or to the order
    // `formatToParts` happens to emit, both halves of this would still be two digits.
    expect(formatDate("2026-06-09T02:00:00.000Z").slice(0, 2)).toBe("09");
    expect(formatDate("2026-06-09T02:00:00.000Z").slice(3, 5)).toBe("06");
  });

  it("moves an instant late in the UTC day to the next day and pads that one-digit day", () => {
    // 20:00Z on 5 January is 03:00 on 6 January in Vietnam, so this crosses the date boundary and
    // lands on a day that needs padding — the two properties in one fixture.
    expect(formatDate("2026-01-05T20:00:00.000Z")).toBe("06/01/2026");
  });

  it("moves an instant that is already the next day in Asia/Ho_Chi_Minh", () => {
    // 17:00Z is 00:00 on 1 March in Vietnam; UTC would print 28/02/2026.
    expect(formatDate("2026-02-28T17:00:00.000Z")).toBe("01/03/2026");
  });

  it("keeps the day for an instant one millisecond before that boundary", () => {
    // 16:59:59.999Z is 23:59:59.999 on 28 February in Vietnam. Together with the case above this
    // pins the boundary exactly, so an off-by-a-minute rounding cannot pass both.
    expect(formatDate("2026-02-28T16:59:59.999Z")).toBe("28/02/2026");
  });

  it("rolls the year over in Vietnam, not in UTC", () => {
    expect(formatDate("2026-12-31T17:00:00.000Z")).toBe("01/01/2027");
  });

  it("reads a date-only string as that date in Vietnam", () => {
    // A billing period's first day arrives as YYYY-MM-DD; parsed as UTC midnight it is still the
    // same day in Vietnam, and this keeps that from being an accident.
    expect(formatDate("2026-03-01")).toBe("01/03/2026");
  });
});

describe("formatMonth", () => {
  it("renders MM/YYYY from a 1-based month", () => {
    expect(formatMonth(2026, 3)).toBe("03/2026");
    expect(formatMonth(2026, 1)).toBe("01/2026");
    expect(formatMonth(2026, 12)).toBe("12/2026");
  });

  it("agrees with formatDate about which month an instant falls in", () => {
    // 31/12/2026 in UTC is January 2027 in Vietnam, so the two must not be computed separately.
    const iso = "2026-12-31T20:00:00.000Z";
    expect(formatDate(iso)).toBe("01/01/2027");
    expect(formatMonth(2027, 1)).toBe("01/2027");
  });
});
