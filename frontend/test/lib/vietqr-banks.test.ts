import { describe, expect, test } from "vitest";
import { VIETQR_BANKS } from "@/lib/vietqr-banks";

describe("VIETQR_BANKS", () => {
  test("contains complete unique transfer-supported bank entries", () => {
    expect(VIETQR_BANKS.length).toBeGreaterThan(0);
    expect(new Set(VIETQR_BANKS.map((bank) => bank.bin)).size).toBe(VIETQR_BANKS.length);
    expect(VIETQR_BANKS.find((bank) => bank.shortName === "Vietcombank")?.bin).toBe("970436");
    expect(VIETQR_BANKS.find((bank) => bank.shortName === "VietinBank")?.bin).toBe("970415");
    expect(VIETQR_BANKS.find((bank) => bank.bin === "970444")).toMatchObject({
      name: "Ngân hàng Thương mại trách nhiệm hữu hạn một thành viên Ngoại thương Công nghệ số (Vietcombank Neo Limited)",
      shortName: "CBBank",
    });
    expect(VIETQR_BANKS.find((bank) => bank.shortName === "COOPBANK")?.bin).toBe("970446");
    for (const bank of VIETQR_BANKS) {
      expect(bank.bin).toMatch(/^\d+$/);
      expect(bank.name.trim()).not.toBe("");
      expect(bank.shortName.trim()).not.toBe("");
      expect(bank.logo).toMatch(/^https:\/\/cdn\.vietqr\.io\/img\/.+\.png$/);
    }
  });
});
