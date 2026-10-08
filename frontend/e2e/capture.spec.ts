import { expect, test } from "@playwright/test";

test.describe("offline meter capture", () => {
  test.beforeEach(async ({ page, context }) => { await context.addCookies([{ name: "manager_session", value: "capture-session", domain: "localhost", path: "/" }]); await page.goto("/capture?motel=a1a1a1a1-b2b2-c3c3-d4d4-e5e5f5f5f5f5"); });

  test("shows independent capture entry and draft period", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Nhập chỉ số" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Mở kỳ/ })).toBeVisible();
  });

  test("keeps capture navigation available at mobile width", async ({ page }) => {
    await page.getByRole("link", { name: /Mở kỳ/ }).click();
    await expect(page).toHaveURL(/\/capture\/b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e/);
    await expect(page.getByRole("heading", { name: /Nhập chỉ số/ })).toBeVisible();
    await expect(page.getByText(/P\.101/)).toBeVisible();
  });

  test("keeps API and signed URL responses out of Cache Storage", async ({ page }) => {
    await page.evaluate(async () => { await fetch("/api/auth/me", { headers: { RSC: "1" } }); await fetch("/capture/signed-url").catch(() => undefined); });
    const keys = await page.evaluate(async () => { const names = await caches.keys(); const urls: string[] = []; for (const name of names) { const cache = await caches.open(name); for (const request of await cache.keys()) urls.push(request.url); } return urls; });
    expect(keys.some((url) => url.includes("/api/"))).toBe(false);
    expect(keys.some((url) => url.includes("signed-url"))).toBe(false);
  });
});
