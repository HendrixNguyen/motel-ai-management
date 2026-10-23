import { describe, expect, it } from "vitest";
import { buildAssistedZaloMessage } from "@/lib/assisted-zalo-message";

describe("assisted Zalo billing message", () => {
  it("normalizes Vietnamese phones and includes amount and renter portal link", () => {
    expect(
      buildAssistedZaloMessage({
        renter: { phone: "84901234567" },
        invoice: { roomName: "101", totalAmount: "3850000" },
        month: 2,
        year: 2026,
        portalUrl: "https://motel.example/r/token",
      }),
    ).toEqual({
      text: "Hóa đơn phòng 101 tháng 02/2026: 3.850.000 ₫. Xem chi tiết và thanh toán: https://motel.example/r/token",
      url: "https://zalo.me/0901234567",
    });
  });
});
