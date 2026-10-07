import { describe, expect, test } from "bun:test";
import { AppError } from "@/shared/errors";
import {
  calculateInvoiceAmounts,
  calculateUsage,
  calculateUtilityCost,
  formatMeterValue,
  parseMeterValue,
} from "@/modules/billing/billing.calculation";

describe("meter arithmetic", () => {
  test("parses and formats hundredths canonically", () => {
    expect(formatMeterValue(parseMeterValue("0"))).toBe("0");
    expect(formatMeterValue(parseMeterValue("12.3"))).toBe("12.3");
    expect(formatMeterValue(parseMeterValue("12.30"))).toBe("12.3");
  });

  test("rejects invalid meter values", () => {
    for (const value of ["-1", "1e2", "1.234", "100000000000.00"]) {
      expect(() => parseMeterValue(value)).toThrow(AppError);
    }
  });

  test("calculates non-negative usage", () => {
    expect(calculateUsage("100.25", "101.50")).toBe("1.25");
    expect(() => calculateUsage("101.50", "100.25")).toThrow(AppError);
  });
});

describe("invoice arithmetic", () => {
  test("rounds utility costs half up", () => {
    expect(calculateUtilityCost("0.01", "49")).toBe("0");
    expect(calculateUtilityCost("0.01", "50")).toBe("1");
    expect(calculateUtilityCost("0.01", "51")).toBe("1");
  });

  test("calculates rent, utilities, fees and total with string amounts", () => {
    expect(calculateInvoiceAmounts({
      electricity: { previous: "100.25", current: "101.50", unitPrice: "2000" },
      water: { previous: "10", current: "11.25", unitPrice: "15000" },
      rentAmount: "90000000000000",
      otherFees: [{ name: "Phí rác", amount: "100000" }],
    })).toEqual({
      electricityUsage: "1.25",
      electricityCost: "2500",
      waterUsage: "1.25",
      waterCost: "18750",
      rentAmount: "90000000000000",
      otherFeesTotal: "100000",
      totalAmount: "90000000121250",
    });
  });
});
