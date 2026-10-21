import { describe, expect, it } from "vitest";
import { buildAssistedZaloMessage } from "@/lib/assisted-zalo-message";

describe("assisted Zalo billing message", () => {
  it("formats a renter-specific bill and normalized Zalo contact link", () => {
    expect(buildAssistedZaloMessage({ phone: "84901234567", roomName: "P.101", month: 10, year: 2026, totalAmount: "3850000", portalUrl: "https://motel.example/r/opaque" })).toEqual({
      text: "Hóa đơn phòng P.101 tháng 10/2026: 3.850.000 ₫. Xem chi tiết và thanh toán: https://motel.example/r/opaque",
      url: "https://zalo.me/0901234567",
    });
  });

  it("preserves phone formats already accepted by Zalo links", () => {
    expect(buildAssistedZaloMessage({ phone: "0901234567", roomName: "1", month: 1, year: 2026, totalAmount: "0", portalUrl: "https://motel.example/r/token" }).url).toBe("https://zalo.me/0901234567");
  });
});
