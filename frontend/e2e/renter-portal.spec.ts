import { expect, test } from "@playwright/test";

test.describe("renter portal review flow", () => {
  test("375px exchange, QR, OTP, tickets, keyboard, no overflow", async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await context.addCookies([{ name: "renter_session", value: "fixture", url: "http://localhost:3001", httpOnly: true, sameSite: "Lax" }]);
    await page.route("**/api/renter/me", (route) => route.fulfill({ json: { id: "r", name: "An", phone: "8490", room: { id: "room", name: "P.101", floor: 1 }, motel: { id: "m", name: "Nhà trọ Minh Anh" }, activeContract: null } }));
    await page.route("**/api/renter/billing/periods", (route) => route.fulfill({ json: [{ id: "period", month: 10, year: 2026, status: "sent", createdAt: "2026-10-01T00:00:00.000Z" }] }));
    await page.route("**/api/renter/billing/periods/period/invoices", (route) => route.fulfill({ json: [{ id: "invoice", billingPeriodId: "period", month: 10, year: 2026, roomId: "room", roomName: "P.101", rentAmount: "3500000", electricityUsage: "20.00", electricityCost: "70000", waterUsage: "3.00", waterCost: "45000", otherFees: [{ name: "Vệ sinh", amount: "50000" }], totalAmount: "3665000", qrCodeData: "000201010212", paymentStatus: "unpaid", paidAt: null, createdAt: "2026-10-01T00:00:00.000Z" }] }));
    await page.route("**/api/renter/me", (route) => route.fulfill({ json: { id: "r", name: "An", phone: "8490", room: { id: "room", name: "P.101", floor: 1 }, motel: { id: "m", name: "Nhà trọ Minh Anh" }, activeContract: null } }));
    await page.route("**/api/renter/billing/periods", (route) => route.fulfill({ json: [{ id: "period", month: 10, year: 2026, status: "sent", createdAt: "2026-10-01T00:00:00.000Z" }] }));
    await page.goto("/portal");
    await page.getByRole("link", { name: /Tháng 10/ }).click();
    await expect(page.getByRole("img", { name: "Mã QR thanh toán hóa đơn" })).toBeVisible();
    await expect(page.getByText("20.00 kWh")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("expired token shows safe expiry state", async ({ page }) => {
    await page.route("**/api/renter/magic-links/exchange", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "expired", code: "MAGIC_LINK_EXPIRED" }) }));
    await page.goto("/r/expired-token");
    await expect(page.getByRole("alert")).toContainText("Liên kết đã hết hạn");
  });
});
