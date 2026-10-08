import { expect, test } from "@playwright/test";

const motel = { id: "motel-1", managerId: "manager-1", name: "Nhà trọ Bình Minh", address: "12 Nguyễn Huệ", electricityPrice: "3500", waterPrice: "15000", otherFees: [], bankAccount: null, createdAt: "2026-01-01T00:00:00.000Z" };

test("dashboard shows operational tasks without horizontal overflow", async ({ page }) => {
  await page.context().addCookies([{ name: "manager_session", value: "dashboard-session", domain: "localhost", path: "/" }]);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const responses: Record<string, unknown> = {
      "/api/auth/me": { id: "manager-1", phone: "84901234567", name: "Chủ trọ" },
      "/api/manager/motels": [motel],
      "/api/manager/motels/motel-1/rooms": [
        { id: "room-1", motelId: "motel-1", name: "P.101", basePrice: "3500000", floor: 1, status: "occupied", createdAt: motel.createdAt },
        { id: "room-2", motelId: "motel-1", name: "P.102", basePrice: "3500000", floor: 1, status: "available", createdAt: motel.createdAt },
      ],
      "/api/manager/motels/motel-1/renters": [{ id: "renter-1", motelId: "motel-1", name: "Trần Thị B", phone: "84901234567", idNumber: null, idCardFrontUrl: null, idCardBackUrl: null, roomId: "room-1", zaloOaId: null, isOaFollower: false, status: "active", createdAt: motel.createdAt }],
      "/api/manager/motels/motel-1/billing/periods": [{ id: "period-1", motelId: "motel-1", month: 10, year: 2026, status: "sent", createdAt: motel.createdAt }],
      "/api/manager/motels/motel-1/billing/periods/period-1/invoices": [{ id: "invoice-1", billingPeriodId: "period-1", roomId: "room-1", roomName: "P.101", renterId: "renter-1", motelId: "motel-1", rentAmount: "3500000", electricityUsage: "20", electricityCost: "70000", waterUsage: "3", waterCost: "45000", otherFees: [], totalAmount: "3615000", qrCodeData: null, paymentStatus: "unpaid", paidAt: null, createdAt: motel.createdAt }],
    };
    if (!(path in responses)) throw new Error(`Missing fixture: ${path}`);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(responses[path]) });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
  await expect(page.getByText("Phòng trống", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Hóa đơn chưa thanh toán/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Thêm khách thuê" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
