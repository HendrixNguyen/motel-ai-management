import { expect, test } from "@playwright/test";

test("Zalo/provider failure shows safe retryable error without provider details", async ({ page }) => {
  await page.context().addCookies([{ name: "renter_session", value: "fixture", domain: "localhost", path: "/" }]);
  await page.route("**/api/renter/tickets", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Đã xảy ra lỗi hệ thống", code: "EXTERNAL_SERVICE_ERROR", details: { failureReason: "provider_unavailable" } }) });
      return;
    }
    await route.fulfill({ json: [] });
  });
  await page.goto("/portal/tickets");
  await page.getByLabel("Mô tả").fill("Nước bị rò rỉ trong phòng");
  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(page.locator('form p.text-danger')).toContainText("Đã xảy ra lỗi hệ thống");
  await expect(page.locator('form p.text-danger')).not.toContainText(/provider|token|secret|access/i);
});

test("Zalo failure keeps renter ticket form retryable", async ({ page }) => {
  await page.context().addCookies([{ name: "renter_session", value: "fixture", domain: "localhost", path: "/" }]);
  let attempts = 0;
  await page.route("**/api/renter/tickets", async (route) => {
    if (route.request().method() === "POST") {
      attempts += 1;
      await route.fulfill({ status: attempts === 1 ? 502 : 201, contentType: "application/json", body: JSON.stringify(attempts === 1 ? { error: "Đã xảy ra lỗi hệ thống", code: "EXTERNAL_SERVICE_ERROR" } : { id: "ticket", category: "water", description: "Nước bị rò rỉ trong phòng", status: "open", createdAt: new Date().toISOString() }) });
      return;
    }
    await route.fulfill({ json: [] });
  });
  await page.goto("/portal/tickets");
  await page.getByLabel("Mô tả").fill("Nước bị rò rỉ trong phòng");
  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(page.locator('form p.text-danger')).toBeVisible();
  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(page.getByText("Chủ nhà trọ sẽ phản hồi qua Zalo")).toBeVisible();
  expect(attempts).toBe(2);
});
