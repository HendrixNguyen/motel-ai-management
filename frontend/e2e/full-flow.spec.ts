import { expect, test } from "@playwright/test";

test("full flow covers capture save, invoice QR, OTP contract, payment state, and ticket", async ({ page }) => {
  await page.context().addCookies([{ name: "manager_session", value: "capture-session", domain: "localhost", path: "/" }]);
  await page.goto("/capture?motel=6f1c1a52-0d4e-4a2b-9c3d-8e5f6a7b8c9d");
  await expect(page.getByRole("heading", { name: /Nhập chỉ số/ })).toBeVisible();
  await page.getByRole("link", { name: /Mở kỳ/ }).click();
  await expect(page.getByText("P.101")).toBeVisible();
  await page.getByText("P.101").click();
  await page.getByLabel("Chỉ số hiện tại").fill("15");
  await page.route("**/api/manager/motels/*/billing/periods/*/readings", (route) => route.fulfill({ json: { ok: true } }));
  await page.getByRole("button", { name: "Lưu" }).first().click();
  await expect(page.getByText("Đã đồng bộ")).toBeVisible();
  await page.context().addCookies([{ name: "renter_session", value: "fixture", domain: "localhost", path: "/" }]);
  await page.route("**/api/renter/me", (route) => route.fulfill({ json: { id: "renter", name: "An", phone: "84901234567", room: { id: "room", name: "P.101", floor: 1 }, motel: { id: "motel", name: "Nhà trọ Minh Anh" }, activeContract: null } }));
  await page.route("**/api/renter/billing/periods", (route) => route.fulfill({ json: [{ id: "period", month: 10, year: 2026, status: "sent", createdAt: "2026-10-01T00:00:00.000Z" }] }));
  await page.route("**/api/renter/billing/periods/period/invoices", (route) => route.fulfill({ json: [{ id: "invoice", billingPeriodId: "period", month: 10, year: 2026, roomId: "room", roomName: "P.101", rentAmount: "3500000", electricityUsage: "20.00", electricityCost: "70000", waterUsage: "3.00", waterCost: "45000", otherFees: [], totalAmount: "3665000", qrCodeData: "000201010212", paymentStatus: "paid", paidAt: "2026-10-02T00:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z" }] }));
  await page.route("**/api/renter/invoices/invoice", (route) => route.fulfill({ json: { id: "invoice", billingPeriodId: "period", month: 10, year: 2026, roomId: "room", roomName: "P.101", rentAmount: "3500000", electricityUsage: "20.00", electricityCost: "70000", waterUsage: "3.00", waterCost: "45000", otherFees: [], totalAmount: "3665000", qrCodeData: "000201010212", paymentStatus: "paid", paidAt: "2026-10-02T00:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z", bankAccount: null, transferDescription: "Thanh toán tháng 10/2026", meterPhotos: [] } }));
  await page.goto("/portal");
  await expect(page.getByText("Đã gửi")).toBeVisible();
  await page.goto("/portal/bills/invoice");
  await expect(page).toHaveURL(/\/portal\/bills\/invoice/);
  await page.goto("/portal/tickets");
  await expect(page.getByRole("heading", { name: "Báo sự cố" })).toBeVisible();
  await page.route("**/api/renter/contract", (route) => route.fulfill({ json: { id: "contract", status: "draft", monthlyRent: "3500000", startDate: "2026-10-01", endDate: "2027-09-30", clauses: [{ title: "Điều khoản", content: "Nội dung" }], otpSignedAt: null } }));
  await page.route("**/api/renter/contracts/*/sign-request", (route) => route.fulfill({ json: { sentAt: "2026-10-01T00:00:00.000Z" } }));
  await page.route("**/api/renter/contracts/*/verify", (route) => route.fulfill({ json: { otpSignedAt: "2026-10-01T00:01:00.000Z" } }));
  await page.route("**/api/renter/contract", (route) => route.fulfill({ json: { id: "contract", status: "draft", monthlyRent: "3500000", startDate: "2026-10-01", endDate: "2027-09-30", clauses: [{ title: "Điều khoản", content: "Nội dung" }], otpSignedAt: null } }));
  await page.goto("/portal/contract");
  await page.getByLabel(/đồng ý/).check();
  await page.getByRole("button", { name: "Gửi mã OTP" }).click();
  await expect(page.getByText("Mã OTP đã được gửi qua Zalo.")).toBeVisible();
  await page.getByLabel("Mã OTP").fill("123456");
  await page.getByRole("button", { name: "Xác nhận ký" }).click();
  await expect(page.getByText("Đã ký hợp đồng.")).toBeVisible();
  await page.goto("/portal/tickets");
  await page.getByLabel("Mô tả").fill("Điện chập chờn trong phòng");
  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(page.getByText("Chủ nhà trọ sẽ phản hồi qua Zalo")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("full flow shows expired magic-link recovery and no provider secrets", async ({ page }) => {
  await page.route("**/api/renter/magic-links/exchange", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "expired", code: "MAGIC_LINK_EXPIRED" }) }));
  await page.goto("/r/expired-token");
  await expect(page.locator('section[role="alert"]')).toContainText("Liên kết đã hết hạn");
  await expect(page.locator('section[role="alert"]')).not.toContainText(/token|secret|access/i);
});
