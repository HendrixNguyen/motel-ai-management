import { test, expect } from "@playwright/test";

test("debug request failures", async ({ page }) => {
  const failedRequests: string[] = [];
  page.on("requestfailed", (request) => {
    failedRequests.push(`FAILED: ${request.url()} - ${request.failure()?.errorText}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedRequests.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("manager@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
  
  await page.getByLabel("Menu phụ, Tài khoản", { exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/.*login/);
  
  await page.goto("/renters");
  await expect(page).toHaveURL(/.*login/);
  
  console.log("Failed requests:", failedRequests);
  expect(failedRequests.length).toBe(0);
});
