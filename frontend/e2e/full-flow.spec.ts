import { expect, test } from "@playwright/test";
import { MANAGER_ME } from "../src/lib/api/__tests__/fixtures";

test("unauthenticated and expired renter sessions cannot read portal data", async ({ page, context }) => {
  const unauthenticated = await page.request.get("/api/renter/me");
  expect(unauthenticated.status()).toBe(401);
  await context.addCookies([{ name: "renter_session", value: "expired", url: "http://localhost:3001" }]);
  const expired = await page.request.get("/api/renter/billing/periods");
  expect(expired.status()).toBe(401);
});

test("manager and renter sessions route independently at 430px", async ({ page, context }) => {
  await context.addCookies([
    { name: "manager_session", value: "valid", url: "http://localhost:3001" },
    { name: "renter_session", value: "fixture", url: "http://localhost:3001" },
  ]);
  const manager = await page.request.get("/api/auth/me");
  expect(manager.status()).toBe(200);
  const renter = await page.request.get("/api/renter/me");
  expect(renter.status()).toBe(200);
});

test("manager login, magic-link exchange, portal read flow works at 430px", async ({ page, context }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(MANAGER_ME.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
  expect((await context.cookies()).find((cookie) => cookie.name === "manager_session")?.httpOnly).toBe(true);

  await context.clearCookies();
  await page.goto("/r/flow-token");
  await expect(page).toHaveURL("/portal");
  expect((await context.cookies()).find((cookie) => cookie.name === "renter_session")?.httpOnly).toBe(true);
  await expect(page.getByRole("heading", { name: "Hóa đơn của tôi" })).toBeVisible();
  await expect(page.getByText("Tháng 10/2026")).toBeVisible();
  await expect(page.getByText("Nhà trọ Minh Anh · P.101")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("fixture-level magic-link exchange supports keyboard submission and rejects replay", async ({ page }) => {
  await page.goto("/renter");
  await page.getByLabel("Mã liên kết").fill("keyboard-token");
  await page.getByLabel("Mã liên kết").press("Tab");
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).press("Enter");
  await expect(page).toHaveURL("/portal");

  await page.context().clearCookies();
  await page.goto("/r/keyboard-token");
  await expect(page.locator('section[role="alert"]')).toContainText("Liên kết đã hết hạn");
});

test("fixture-level unknown magic-link shows expired recovery without leaking internals", async ({ page }) => {
  const response = await page.request.post("/api/renter/magic-links/exchange", { data: { token: "bad!" } });
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "Liên kết đã hết hạn", code: "MAGIC_LINK_EXPIRED" });
  await page.goto("/r/bad!");
  await expect(page.locator('section[role="alert"]')).toContainText("Liên kết đã hết hạn");
  await expect(page.locator('section[role="alert"]')).not.toContainText(/token|secret|private|host/i);
});

test("capture save, invoice QR, and UI-only OTP contract and ticket journey", async ({ page }) => {
  await page.context().addCookies([{ name: "manager_session", value: "capture-session", domain: "localhost", path: "/" }]);
  await page.goto("/capture?motel=6f1c1a52-0d4e-4a2b-9c3d-8e5f6a7b8c9d");
  await expect(page.getByRole("heading", { name: /Nhập chỉ số/ })).toBeVisible();
  await page.getByRole("link", { name: /Mở kỳ/ }).click();
  await expect(page.getByRole("link", { name: /Phòng P\.101/ })).toBeVisible();
  await page.getByRole("link", { name: /Phòng P\.101/ }).click();
  await page.getByLabel("Chỉ số hiện tại").fill("15");
  await page.route("**/api/manager/motels/*/billing/periods/*/readings", (route) => route.fulfill({ json: { ok: true } }));
  await page.getByRole("button", { name: "Lưu" }).first().click();
  await expect(page.getByText("Đã đồng bộ")).toBeVisible();
  await page.context().addCookies([{ name: "renter_session", value: "fixture", domain: "localhost", path: "/" }]);
  let ticketPayload: Record<string, unknown> | undefined;
  let ticketResponse: Record<string, unknown> | undefined;
  await page.route("**/api/renter/magic-links/exchange", async (route) => { expect(await route.request().postDataJSON()).toEqual({ token: "flow-token" }); await route.fulfill({ json: { renterId: "renter", motelId: "motel" }, headers: { "set-cookie": "renter_session=fixture; Path=/; HttpOnly" } }); });
  await page.route("**/api/renter/me", (route) => route.fulfill({ json: { id: "renter", name: "An", phone: "84901234567", room: { id: "room", name: "P.101", floor: 1 }, motel: { id: "motel", name: "Nhà trọ Minh Anh" }, activeContract: null } }));
  await page.route("**/api/renter/billing/periods", (route) => route.fulfill({ json: [{ id: "period", month: 10, year: 2026, status: "sent", createdAt: "2026-10-01T00:00:00.000Z" }] }));
  await page.route("**/api/renter/billing/periods/period/invoices", (route) => route.fulfill({ json: [{ id: "invoice", billingPeriodId: "period", month: 10, year: 2026, roomId: "room", roomName: "P.101", rentAmount: "3500000", electricityUsage: "20.00", electricityCost: "70000", waterUsage: "3.00", waterCost: "45000", otherFees: [], totalAmount: "3665000", qrCodeData: "000201010212", paymentStatus: "unpaid", paidAt: null, createdAt: "2026-10-01T00:00:00.000Z" }] }));
  await page.route("**/api/renter/invoices/invoice", (route) => route.fulfill({ json: { id: "invoice", billingPeriodId: "period", month: 10, year: 2026, roomId: "room", roomName: "P.101", rentAmount: "3500000", electricityUsage: "20.00", electricityCost: "70000", waterUsage: "3.00", waterCost: "45000", otherFees: [], totalAmount: "3665000", qrCodeData: "000201010212", paymentStatus: "unpaid", paidAt: null, createdAt: "2026-10-01T00:00:00.000Z", bankAccount: null, transferDescription: "Thanh toán tháng 10/2026", meterPhotos: [] } }));
  await page.goto("/r/flow-token");
  await expect(page).toHaveURL("http://localhost:3001/portal");
  await expect(page.context().cookies()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ name: "renter_session" })]));
  await expect(page.getByText("Đã gửi")).toBeVisible();
  await page.goto("/portal/bills/invoice");
  await expect(page.getByRole("heading", { name: "Hóa đơn tháng 10/2026" })).toBeVisible();
  await expect(page.getByText("3.665.000 ₫")).toBeVisible();
  await expect(page.getByText("Chưa thanh toán")).toBeVisible();
  await expect(page.locator('canvas[aria-label="Mã QR thanh toán hóa đơn"]')).toBeVisible();
  await expect(page).toHaveURL(/\/portal\/bills\/invoice/);
  await page.goto("/portal/tickets");
  await expect(page.getByRole("heading", { name: "Báo sự cố" })).toBeVisible();
  let verifyPayload: Record<string, unknown> | undefined;
  await page.route("**/api/renter/contracts/*/sign-request", (route) => route.fulfill({ json: { sentAt: "2026-10-01T00:00:00.000Z" } }));
  page.on("request", (request) => { if (request.url().includes("/api/renter/contracts/") && request.url().endsWith("/verify")) verifyPayload = request.postDataJSON() as Record<string, unknown>; });
  await page.goto("/portal/contract");
  await page.getByLabel(/đồng ý/).check();
  await page.getByRole("button", { name: "Gửi mã OTP" }).click();
  await expect(page.getByText("Mã OTP đã được gửi qua Zalo.")).toBeVisible();
  await page.getByLabel("Mã OTP").fill("123456");
  await page.getByRole("button", { name: "Xác nhận ký" }).click();
  await expect(page.getByText("Đã ký hợp đồng.")).toBeVisible();
  expect(verifyPayload).toEqual({ otp: "123456" });
  await expect(page).toHaveURL(/\/portal\/contract/);
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.getByText("Đang hiệu lực")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: "Xác nhận ký" })).toHaveCount(0);
  await page.route("**/api/renter/tickets", async (route) => { if (route.request().method() === "POST") { ticketPayload = await route.request().postDataJSON(); ticketResponse = { id: "ticket-new", category: String(ticketPayload?.category), description: String(ticketPayload?.description), status: "open", createdAt: "2026-10-08T00:00:00.000Z" }; await route.fulfill({ status: 201, json: ticketResponse }); } else await route.fulfill({ json: [] }); });
  await page.goto("/portal/tickets");
  await page.getByLabel("Mô tả").fill("Điện chập chờn trong phòng");
  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(page.getByText("Chủ nhà trọ sẽ phản hồi qua Zalo")).toBeVisible();
  expect(ticketPayload).toEqual({ category: "facilities", description: "Điện chập chờn trong phòng" });
  expect(ticketResponse).toEqual({ id: "ticket-new", category: "facilities", description: "Điện chập chờn trong phòng", status: "open", createdAt: "2026-10-08T00:00:00.000Z" });
  await expect(page.getByRole("button", { name: "Gửi yêu cầu" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("fixture-level expired magic-link recovery shows no provider secrets", async ({ page }) => {
  await page.route("**/api/renter/magic-links/exchange", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "expired", code: "MAGIC_LINK_EXPIRED" }) }));
  await page.goto("/r/expired-token");
  await expect(page.locator('section[role="alert"]')).toContainText("Liên kết đã hết hạn");
  await expect(page.locator('section[role="alert"]')).not.toContainText(/token|secret|access/i);
});
