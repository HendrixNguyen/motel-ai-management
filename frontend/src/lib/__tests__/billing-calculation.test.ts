import { describe, expect, it } from "vitest";
import { calculateMeterPreview, parseMeterInput } from "@/lib/billing-calculation";

describe("billing meter calculation", () => {
  it("rounds utility cost half up", () => expect(calculateMeterPreview("0.00", "1.00", "3500")).toEqual({ usage: "1.00", cost: "3500" }));
  it("accepts zero and rejects malformed or decreasing values", () => { expect(parseMeterInput("0")).toBe("0.00"); expect(parseMeterInput("abc")).toBeNull(); expect(calculateMeterPreview("2", "1", "10")).toBeNull(); });
  it("rejects values above backend maximum", () => expect(parseMeterInput("10000000000.00")).toBeNull());
});
