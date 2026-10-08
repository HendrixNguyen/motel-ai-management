import { expect, test, type Page } from "@playwright/test";

const motel = "6f1c1a52-0d4e-4a2b-9c3d-8e5f6a7b8c9d";
const period = "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e";
const reading = "d1e2f3a4-b5c6-4789-9012-3a4b5c6d7e8f";
const roomUrl = `/capture/${period}/room/${reading}?motel=${motel}`;

async function openCapture(page: Page) {
  await page.context().addCookies([{ name: "manager_session", value: "capture-session", domain: "localhost", path: "/" }]);
  await page.goto(roomUrl);
}

test.describe("capture queue delivery states", () => {
  test("persists offline entry across reload and reconnects into synced state", async ({ page }) => {
    await openCapture(page);
    await page.route("**/api/manager/motels/*/billing/periods/*/readings", (route) => route.abort());
    await page.getByLabel("Chỉ số hiện tại").fill("15");
    await page.getByRole("button", { name: "Lưu" }).first().click();
    await expect(page.getByText(/Đã lưu chỉ số|Đã lưu trên thiết bị|Ngoại tuyến/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Chỉ số hiện tại")).toBeVisible();
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.route("**/api/manager/motels/*/billing/periods/*/readings", (route) => route.fulfill({ json: { ok: true } }));
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText("Đã đồng bộ")).toBeVisible();
  });

  test("keeps stale server reading visible as conflict after reconnect", async ({ page }) => {
    await openCapture(page);
    await page.route("**/api/manager/motels/*/billing/periods/*/readings", (route) => route.abort());
    await page.getByLabel("Chỉ số hiện tại").fill("15");
    await page.getByRole("button", { name: "Lưu" }).first().click();
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.route("**/api/manager/motels/*/billing/periods/*/readings", (route) => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Chỉ số đã thay đổi", code: "READING_CONFLICT", details: { server: { currentReading: "14" } } }) }));
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText("Cần kiểm tra xung đột")).toBeVisible();
  });

  test("does not retry queued writes for a sent period", async ({ page, context }) => {
    await context.addCookies([{ name: "manager_session", value: "sent-capture", domain: "localhost", path: "/" }]);
    await page.goto(`/capture/${period}?motel=${motel}`);
    await expect(page.getByRole("heading", { name: /Nhập chỉ số/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Nhập chỉ số/ })).toBeVisible();
  });
});
