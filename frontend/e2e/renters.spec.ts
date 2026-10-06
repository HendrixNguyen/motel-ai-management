import { expect, test } from "@playwright/test";
import { MOTEL, ROOM, RENTER, RENTER_WITHOUT_ROOM } from "../src/lib/api/__tests__/fixtures";

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([{ name: "manager_session", value: "valid", url: "http://localhost:3001", httpOnly: true, sameSite: "Lax" }]);
  await page.setViewportSize({ width: 360, height: 740 });
});

test("renter rows stack at 360px and room-filter navigation survives detail and reload", async ({ page }) => {
  await page.goto(`/renters?motel=${MOTEL.id}&roomId=${ROOM.id}`);
  const row = page.getByRole("row").filter({ hasText: RENTER.name });
  await expect(row).toContainText("+84 901 234 567");
  await expect(row).toContainText(ROOM.name);
  await expect(page.getByText(RENTER_WITHOUT_ROOM.name, { exact: true })).toHaveCount(0);
  expect(await row.evaluate((element) => getComputedStyle(element).display)).toBe("block");
  await row.getByRole("link", { name: `Xem ${RENTER.name}`, exact: true }).click();
  await expect(page).toHaveURL(`/renters/${RENTER.id}?motel=${MOTEL.id}&roomId=${ROOM.id}`);
  await expect(page.getByRole("heading", { name: "Chưa có hợp đồng đang hiệu lực" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chưa có hóa đơn" })).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Trở về khách thuê" }).click();
  await expect(page).toHaveURL(`/renters?motel=${MOTEL.id}&roomId=${ROOM.id}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("keyboard action creates a relative magic-link POST, shows returned URL and copies it", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { document.documentElement.dataset.copied = value; } } });
  });
  let count = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/manager/motels/${MOTEL.id}/renters/${RENTER.id}/magic-link`, async (route) => {
    count += 1;
    expect(route.request().method()).toBe("POST");
    expect(route.request().postData()).toBeNull();
    await pending;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ token: "opaque", url: "https://motel.example/r/opaque" }) });
  });
  await page.goto(`/renters/${RENTER.id}?motel=${MOTEL.id}`);
  await expect(page.getByRole("button", { name: "Gửi Zalo" })).toHaveCount(0);
  const action = page.getByRole("button", { name: "Tạo magic link", exact: true });
  await action.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Đang tạo…" })).toBeDisabled();
  await expect.poll(() => count).toBe(1);
  release();
  await expect(page.getByLabel("Magic link", { exact: true })).toHaveValue("https://motel.example/r/opaque");
  const copy = page.getByRole("button", { name: "Sao chép magic link", exact: true });
  await copy.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Đã sao chép", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.copied)).toBe("https://motel.example/r/opaque");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const [status, code] of [[404, "NOT_FOUND"], [429, "RATE_LIMITED"], [500, "INTERNAL_ERROR"]] as const) {
  test(`magic-link HTTP ${status} exposes a focused error and allows retry`, async ({ page }) => {
    let attempts = 0;
    await page.route(`**/api/manager/motels/${MOTEL.id}/renters/${RENTER.id}/magic-link`, (route) => {
      attempts += 1;
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: status === 500 ? "private driver" : "Chưa thể tạo liên kết", code }) });
    });
    await page.goto(`/renters/${RENTER.id}?motel=${MOTEL.id}`);
    const action = page.getByRole("button", { name: "Tạo magic link", exact: true });
    await action.click();
    await expect(page.getByRole("alert")).toBeFocused();
    await expect(page.getByRole("alert")).toContainText(status === 500 ? "Đã xảy ra lỗi hệ thống" : "Chưa thể tạo liên kết");
    await expect(page.getByLabel("Magic link", { exact: true })).toHaveCount(0);
    await action.click();
    await expect.poll(() => attempts).toBe(2);
  });
}
test("an expired session during magic-link creation returns to login", async ({ page }) => {
  await page.route(`**/api/manager/motels/${MOTEL.id}/renters/${RENTER.id}/magic-link`, (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Chưa đăng nhập", code: "UNAUTHORIZED" }) }));
  await page.goto(`/renters/${RENTER.id}?motel=${MOTEL.id}`);
  await page.getByRole("button", { name: "Tạo magic link", exact: true }).click();
  await expect(page).toHaveURL("/login");
});
