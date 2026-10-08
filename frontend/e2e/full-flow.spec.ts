import { expect, test } from "@playwright/test";

test("full flow keeps capture delivery evidence and renter provider recovery visible", async ({ page }) => {
  await page.context().addCookies([{ name: "manager_session", value: "capture-session", domain: "localhost", path: "/" }]);
  await page.goto("/capture?motel=6f1c1a52-0d4e-4a2b-9c3d-8e5f6a7b8c9d");
  await expect(page.getByRole("heading", { name: /Nhập chỉ số/ })).toBeVisible();
  await page.getByRole("link", { name: /Mở kỳ/ }).click();
  await expect(page.getByText("P.101")).toBeVisible();
  await page.context().addCookies([{ name: "renter_session", value: "fixture", domain: "localhost", path: "/" }]);
  await page.goto("/portal/tickets");
  await expect(page.getByRole("heading", { name: "Báo sự cố" })).toBeVisible();
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
