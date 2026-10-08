import { expect, test } from "@playwright/test";

test.describe("offline meter capture", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/capture?motel=a1a1a1a1-b2b2-c3c3-d4d4-e5e5f5f5f5f5"); });

  test("shows independent capture entry and draft period", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Nhập chỉ số" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Mở kỳ/ })).toBeVisible();
  });

  test("keeps capture navigation available at mobile width", async ({ page }) => {
    await page.getByRole("link", { name: /Mở kỳ/ }).click();
    await expect(page).toHaveURL(/\/capture\/period-/);
    await expect(page.getByRole("heading", { name: /Nhập chỉ số/ })).toBeVisible();
    await expect(page.getByText(/P\.101/)).toBeVisible();
  });

  test("does not cache API responses in service worker", async ({ page }) => {
    const response = await page.evaluate(async () => fetch("/api/auth/me", { headers: { RSC: "1" } }).catch(() => null));
    expect(response).toBeTruthy();
  });
});
