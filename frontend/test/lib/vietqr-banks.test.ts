import { describe, expect, test } from "vitest";
import { VIETQR_BANKS } from "@/lib/vietqr-banks";

describe("VIETQR_BANKS", () => {
  test("contains complete unique transfer-supported bank entries", () => {
    expect(VIETQR_BANKS.length).toBeGreaterThan(0);
    expect(new Set(VIETQR_BANKS.map((bank) => bank.bin)).size).toBe(VIETQR_BANKS.length);
    for (const bank of VIETQR_BANKS) {
      expect(bank.bin).toMatch(/^\d+$/);
      expect(bank.name.trim()).not.toBe("");
      expect(bank.shortName.trim()).not.toBe("");
      expect(bank.logo).toMatch(/^https:\/\/cdn\.vietqr\.io\/img\/.+\.png$/);
    }
  });
});
