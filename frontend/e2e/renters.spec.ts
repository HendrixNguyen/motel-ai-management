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

for (const [status, code] of [[400, "VALIDATION_ERROR"], [404, "NOT_FOUND"], [409, "CONFLICT"], [500, "INTERNAL_ERROR"]] as const) {
  test(`renter edit HTTP ${status} keeps the draft and presents a focused safe banner`, async ({ page }) => {
    await page.route(`**/api/manager/motels/${MOTEL.id}/renters/${RENTER.id}`, (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: status === 500 ? "private driver location" : "Không thể lưu khách thuê", code }) }));
    await page.goto(`/renters?motel=${MOTEL.id}`);
    await page.getByRole("button", { name: `Chỉnh sửa ${RENTER.name}`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Chỉnh sửa khách thuê", exact: true });
    await dialog.getByLabel("Họ tên", { exact: true }).fill("Tên bản nháp");
    await dialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeFocused();
    await expect(dialog.getByRole("alert")).toContainText(status === 500 ? "Đã xảy ra lỗi hệ thống" : "Không thể lưu khách thuê");
    await expect(dialog.getByLabel("Họ tên", { exact: true })).toHaveValue("Tên bản nháp");
    if (status === 404) {
      await dialog.getByRole("button", { name: "Tải lại danh sách", exact: true }).click();
      await expect(dialog).not.toBeVisible();
    }
  });
}

test("an expired session during renter save returns to login", async ({ page }) => {
  await page.route(`**/api/manager/motels/${MOTEL.id}/renters/${RENTER.id}`, (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Chưa đăng nhập", code: "UNAUTHORIZED" }) }));
  await page.goto(`/renters?motel=${MOTEL.id}`);
  await page.getByRole("button", { name: `Chỉnh sửa ${RENTER.name}`, exact: true }).click();
  await page.getByRole("dialog", { name: "Chỉnh sửa khách thuê", exact: true }).getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("a pending renter save disables controls and cannot close a newer editing session", async ({ page, context }) => {
  await context.addCookies([{ name: "manager_session", value: `renter-refresh-${crypto.randomUUID()}`, url: "http://localhost:3001", httpOnly: true, sameSite: "Lax" }]);
  const inputs: unknown[] = [];
  let release!: () => void;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/manager/motels/${MOTEL.id}/renters/${RENTER.id}`, async (route) => {
    inputs.push(route.request().postDataJSON());
    if (inputs.length === 1) await ready;
    await route.fulfill({ response: await route.fetch() });
  });
  await page.goto(`/renters?motel=${MOTEL.id}`);
  const trigger = page.getByRole("button", { name: `Chỉnh sửa ${RENTER.name}`, exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa khách thuê", exact: true });
  await dialog.getByLabel("Họ tên", { exact: true }).fill("Tên đã lưu");
  await dialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Đang lưu…", exact: true })).toBeDisabled();
  await expect(dialog.getByLabel("Họ tên", { exact: true })).toBeDisabled();
  await expect.poll(() => inputs.length).toBe(1);
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await trigger.click();
  release();
  await expect(page.getByRole("button", { name: "Chỉnh sửa Tên đã lưu", exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Họ tên", { exact: true })).toHaveValue(RENTER.name);
  await dialog.getByLabel("Số CCCD (không bắt buộc)", { exact: true }).fill("");
  await dialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(inputs).toEqual([{ name: "Tên đã lưu" }, { idNumber: null }]);
  await expect(page.getByRole("row").filter({ hasText: "Tên đã lưu" })).toContainText("Chưa cập nhật");
});
