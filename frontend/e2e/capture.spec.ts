import { expect, test } from "@playwright/test";

test.describe("offline meter capture", () => {
  test.beforeEach(async ({ page, context }) => { await context.addCookies([{ name: "manager_session", value: "capture-session", domain: "localhost", path: "/" }]); await page.goto("/capture?motel=a1a1a1a1-b2b2-c3c3-d4d4-e5e5f5f5f5f5"); });

  test("shows a draft entry without claiming unavailable room progress", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Nhập chỉ số" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mở kỳ 10/2026" })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Tiến độ phòng chưa có trong dữ liệu danh sách kỳ.");
    await expect(page.getByRole("main")).not.toContainText(/\d+\/\d+ phòng/);
  });

  test("opens period then focused reading screen", async ({ page }) => {
    await page.getByRole("link", { name: "Mở kỳ 10/2026" }).click();
    await expect(page).toHaveURL(/\/capture\/b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e\?motel=/);
    await expect(page.getByRole("heading", { name: /Nhập chỉ số 10\/2026/ })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("trước 100");
    await expect(page.getByRole("main")).toContainText("Trạng thái đồng bộ sẽ hiển thị trong trang nhập.");
    await expect(page.getByRole("main")).not.toContainText("Đã đồng bộ");
    await page.getByRole("link", { name: /Phòng P\.101/ }).click();
    await expect(page).toHaveURL(/\/capture\/b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e\/room\/d1e2f3a4-b5c6-4789-9012-3a4b5c6d7e8f/);
    await expect(page.getByLabel("Chỉ số hiện tại")).toBeVisible();
    await expect(page.getByRole("main").getByRole("navigation")).toHaveCount(0);
  });

  for (const width of [360, 375, 430, 640, 768]) {
    test(`capture period layout has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.getByRole("link", { name: "Mở kỳ 10/2026" }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const hitTarget = await page.getByRole("link", { name: /Phòng P\.101/ }).evaluate((element) => {
        const { height } = element.getBoundingClientRect();
        return height >= 44;
      });
      expect(hitTarget).toBe(true);
    });
  }

  test("keeps API and signed URL responses out of Cache Storage", async ({ page }) => {
    await page.evaluate(async () => { await fetch("/api/auth/me", { headers: { RSC: "1" } }); await fetch("/capture/signed-url").catch(() => undefined); });
    const keys = await page.evaluate(async () => { const names = await caches.keys(); const urls: string[] = []; for (const name of names) { const cache = await caches.open(name); for (const request of await cache.keys()) urls.push(request.url); } return urls; });
    expect(keys.some((url) => url.includes("/api/"))).toBe(false);
    expect(keys.some((url) => url.includes("signed-url"))).toBe(false);
  });
});
