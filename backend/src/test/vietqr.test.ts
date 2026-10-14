import { describe, expect, test } from "bun:test";
import { buildTransferDescription, buildVietQrPayload } from "@/modules/vietqr/vietqr.service";

describe("VietQR", () => {
  test("builds canonical transfer payload", () => {
    expect(buildVietQrPayload({
      bankBin: "970415",
      accountNumber: "113366668888",
      amount: "79000",
      description: "Ung Ho Quy Vac Xin",
    })).toBe("00020101021238560010A0000007270126000697041501121133666688880208QRIBFTTA53037045405790005802VN62220818Ung Ho Quy Vac Xin63043ACF");
  });

  test("normalizes description and preserves matching suffix", () => {
    expect(buildTransferDescription({ motelName: "Nhà trọ Đẹp", month: 10, year: 2026, roomName: "P.101" })).toBe("T10/2026 PP.101");
  });
});
