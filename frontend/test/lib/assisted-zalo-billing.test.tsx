import { describe, expect, it } from "vitest";
import { buildAssistedZaloMessage } from "@/lib/assisted-zalo-message";

describe("assisted Zalo billing message", () => {
  it("formats a renter-specific bill and normalized Zalo contact link", () => {
    expect(buildAssistedZaloMessage({ renter: { phone: "84901234567" }, invoice: { roomName: "P.101", totalAmount: "3850000" }, month: 10, year: 2026, portalUrl: "https://motel.example/r/opaque" })).toEqual({
      text: "Hóa đơn phòng P.101 tháng 10/2026: 3.850.000 ₫. Xem chi tiết và thanh toán: https://motel.example/r/opaque",
      url: "https://zalo.me/0901234567",
    });
  });

  it("preserves phone formats already accepted by Zalo links", () => {
    expect(buildAssistedZaloMessage({ renter: { phone: "0901234567" }, invoice: { roomName: "1", totalAmount: "0" }, month: 1, year: 2026, portalUrl: "https://motel.example/r/token" }).url).toBe("https://zalo.me/0901234567");
  });
});
