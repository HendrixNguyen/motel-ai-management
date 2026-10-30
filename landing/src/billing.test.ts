import { describe, expect, it } from "vite-plus/test";
import { calculateBill, sample, validateReadings } from "./billing";

describe("billing demo", () => {
  it("calculates the illustrated bill for room A102", () => {
    expect(calculateBill({ electricity: 1310, water: 85 })).toMatchObject({
      rent: 2_500_000,
      electricity: { used: 70, amount: 245_000 },
      water: { used: 5, amount: 75_000 },
      total: 2_820_000,
    });
  });

  it("allows zero usage", () => {
    expect(
      calculateBill({
        electricity: sample.electricity.previous,
        water: sample.water.previous,
      }).total,
    ).toBe(2_500_000);
  });

  it.each([
    ["", "85"],
    ["1239", "85"],
    ["1310.5", "85"],
    ["-1", "85"],
    ["9007199254740991", "85"],
    ["1310", "Infinity"],
    ["NaN", "85"],
  ])("rejects invalid readings %s and %s", (electricity, water) => {
    expect(() => validateReadings(electricity, water)).toThrow(RangeError);
  });

  it("rejects totals outside the safe integer range", () => {
    expect(() =>
      calculateBill({ electricity: Number.MAX_SAFE_INTEGER, water: 85 }),
    ).toThrow(RangeError);
  });
});
