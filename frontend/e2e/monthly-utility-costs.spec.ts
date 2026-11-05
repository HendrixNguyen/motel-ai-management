import { expect, test } from "@playwright/test";
import { MOTEL_ID } from "../test/lib/api/fixtures";

async function useManagerSession(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      { name: "manager_session", value: "monthly-cost-session", domain: "localhost", path: "/" },
    ]);
}

test.describe("monthly utility costs", () => {
  test("shows no-period report and saves monthly supplier totals", async ({ page }) => {
    await useManagerSession(page);
    await page.goto(`/billing?motel=${MOTEL_ID}&year=2026&month=10`);
    await expect(page.getByRole("heading", { name: "Thu/chi điện nước" })).toBeVisible();
    await expect(page.getByText(/Chưa có kỳ hóa đơn đã chốt/)).toBeVisible();
    await page.getByRole("button", { name: "Nhập chi phí" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Tiền điện tổng đã trả").fill("1500000");
    await page.getByLabel("Tiền nước tổng đã trả").fill("500000");
    await page.getByRole("button", { name: "Lưu chi phí" }).click();
    await expect(page.getByRole("status")).toHaveText("Đã lưu chi phí điện nước.");
  });

  test("keeps selected motel and month in report filter", async ({ page }) => {
    await useManagerSession(page);
    await page.goto(`/billing?motel=${MOTEL_ID}&year=2026&month=10`);
    await page.getByLabel("Tháng báo cáo").selectOption("9");
    await page.getByRole("button", { name: "Xem tháng" }).click();
    await expect(page).toHaveURL(new RegExp(`/billing\\?motel=${MOTEL_ID}&month=9&year=2026`));
  });
});
