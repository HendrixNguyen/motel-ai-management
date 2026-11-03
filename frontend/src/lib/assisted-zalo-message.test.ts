import { describe, expect, test } from "vitest";
import { buildAssistedZaloMessage } from "./assisted-zalo-message";

describe("buildAssistedZaloMessage", () => {
  test("uses confirmed Zalo number and never contact number", () => {
    const result = buildAssistedZaloMessage({
      renter: { zaloPhone: "84912345678" },
      invoice: { roomName: "P.101", totalAmount: "3500000" },
      month: 11,
      year: 2026,
      portalUrl: "https://portal.example/link",
    });
    expect(result?.url).toBe("https://zalo.me/0912345678");
  });

  test("does not fall back to a contact number when Zalo number is unconfirmed", () => {
    expect(
      buildAssistedZaloMessage({
        renter: { zaloPhone: null },
        invoice: { roomName: "P.101", totalAmount: "3500000" },
        month: 11,
        year: 2026,
        portalUrl: "https://portal.example/link",
      }),
    ).toBeNull();
  });
});
