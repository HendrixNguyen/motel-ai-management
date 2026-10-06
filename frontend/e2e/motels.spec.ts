import { expect, test, type BrowserContext } from "@playwright/test";
import { MOTEL } from "../src/lib/api/__tests__/fixtures";

async function signIn(context: BrowserContext, session = "valid") {
  await context.addCookies([{ name: "manager_session", value: session, url: "http://localhost:3001", httpOnly: true, sameSite: "Lax" }]);
}

test("motel grid uses live counts and stays inside 360px", async ({ page, context }) => {
  await signIn(context);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/motels");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: MOTEL.name }) });
  await expect(card).toContainText("2 phòng");
  await expect(card).toContainText("3.500 ₫");
  await expect(card).toContainText("NGUYEN VAN MINH");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("empty motel list opens creation and announces field errors with a linked summary", async ({ page, context }) => {
  await signIn(context, "no-motels");
  await page.goto("/motels");
  await expect(page.getByRole("heading", { name: "Chưa có nhà trọ" })).toBeVisible();
  await page.getByRole("button", { name: "Tạo nhà trọ", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo nhà trọ" });
  await dialog.getByRole("button", { name: "Tạo nhà trọ", exact: true }).click();
  await expect(dialog.getByLabel("Tên nhà trọ", { exact: true })).toHaveAccessibleDescription("Nhập tên nhà trọ");
  await expect(dialog.getByRole("alert")).toBeFocused();
  await dialog.getByRole("link", { name: "Nhập tên nhà trọ" }).click();
  await expect(dialog.getByLabel("Tên nhà trọ", { exact: true })).toBeFocused();
});

test("creating a motel sends normalized prices, closes and confirms success", async ({ page, context }) => {
  await signIn(context);
  let input: unknown;
  await page.route("**/api/manager/motels", async (route) => {
    input = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(MOTEL) });
  });
  await page.goto("/motels");
  const trigger = page.getByRole("button", { name: "Tạo nhà trọ", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Tạo nhà trọ" });
  await dialog.getByLabel("Tên nhà trọ", { exact: true }).fill("Nhà trọ mới");
  await dialog.getByLabel("Giá điện (₫/kWh)", { exact: true }).fill("3.500");
  await dialog.getByLabel("Giá nước (₫/m³)", { exact: true }).fill("25.000");
  await dialog.getByRole("button", { name: "Tạo nhà trọ", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Đã tạo nhà trọ", { exact: true })).toBeVisible();
  expect(input).toEqual({ name: "Nhà trọ mới", address: null, electricityPrice: "3500", waterPrice: "25000" });
  await expect(trigger).toBeFocused();
});

test("editing can add fees, update bank details and cancel without a request", async ({ page, context }) => {
  await signIn(context);
  let input: unknown;
  let requests = 0;
  await page.route(`**/api/manager/motels/${MOTEL.id}`, async (route) => {
    requests += 1;
    input = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(MOTEL) });
  });
  await page.goto("/motels");
  const trigger = page.getByRole("button", { name: `Chỉnh sửa ${MOTEL.name}`, exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa nhà trọ" });
  await expect(dialog.getByLabel("Giá điện (₫/kWh)", { exact: true })).toHaveValue("3.500");
  await dialog.getByRole("button", { name: "Thêm phí" }).click();
  await dialog.getByLabel("Tên phí 3", { exact: true }).fill("Internet");
  await dialog.getByLabel("Số tiền phí 3 (₫)", { exact: true }).fill("050.000");
  await dialog.getByLabel("Số tài khoản", { exact: true }).fill("00001234");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  expect(input).toEqual({ otherFees: [...MOTEL.otherFees, { name: "Internet", amount: "50000" }], bankAccount: { ...MOTEL.bankAccount, accountNumber: "00001234" } });
  await trigger.click();
  await dialog.getByLabel("Tên nhà trọ", { exact: true }).fill("Bản nháp");
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(trigger).toBeFocused();
  expect(requests).toBe(1);
  await trigger.click();
  await expect(dialog.getByLabel("Tên nhà trọ", { exact: true })).toHaveValue(MOTEL.name);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

for (const [status, code] of [[409, "CONFLICT"], [400, "VALIDATION_ERROR"], [404, "NOT_FOUND"]] as const) {
  test(`HTTP ${status} keeps the edit draft and shows a form-level banner`, async ({ page, context }) => {
    await signIn(context);
    await page.route(`**/api/manager/motels/${MOTEL.id}`, (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: "Không thể lưu nhà trọ", code }) }));
    await page.goto("/motels");
    await page.getByRole("button", { name: `Chỉnh sửa ${MOTEL.name}`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Chỉnh sửa nhà trọ" });
    await dialog.getByLabel("Tên nhà trọ", { exact: true }).fill("Tên mới");
    await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Không thể lưu nhà trọ");
    await expect(dialog.getByLabel("Tên nhà trọ", { exact: true })).toHaveValue("Tên mới");
    await expect(dialog.getByLabel("Tên nhà trọ", { exact: true })).not.toHaveAttribute("aria-invalid", "true");
    if (status === 404) {
      await dialog.getByRole("button", { name: "Tải lại danh sách" }).click();
      await expect(dialog).not.toBeVisible();
    }
  });
}

test("a pending save disables form controls and allows only one request", async ({ page, context }) => {
  await signIn(context);
  let requests = 0;
  let release!: () => void;
  const responseReady = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/manager/motels/${MOTEL.id}`, async (route) => {
    requests += 1;
    await responseReady;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(MOTEL) });
  });
  await page.goto("/motels");
  await page.getByRole("button", { name: `Chỉnh sửa ${MOTEL.name}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa nhà trọ" });
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
  await expect(dialog.getByLabel("Tên nhà trọ", { exact: true })).toBeDisabled();
  await expect.poll(() => requests).toBe(1);
  release();
  await expect(dialog).not.toBeVisible();
});

test("removing fees and disabling the bank sends explicit clearing values", async ({ page, context }) => {
  await signIn(context);
  let input: unknown;
  await page.route(`**/api/manager/motels/${MOTEL.id}`, async (route) => {
    input = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(MOTEL) });
  });
  await page.goto("/motels");
  await page.getByRole("button", { name: `Chỉnh sửa ${MOTEL.name}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa nhà trọ" });
  await dialog.getByRole("button", { name: "Xóa phí 1: Vệ sinh chung", exact: true }).click();
  await dialog.getByRole("button", { name: "Xóa phí 1: Gửi xe", exact: true }).click();
  await dialog.getByLabel("Thiết lập tài khoản nhận tiền", { exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  expect(input).toEqual({ otherFees: [], bankAccount: null });
});

test("a refreshed motel cannot turn an untouched old name into a second PATCH", async ({ page, context }) => {
  await signIn(context, `motel-refresh-${crypto.randomUUID()}`);
  const patches: unknown[] = [];
  let release!: () => void;
  const responseReady = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/manager/motels/${MOTEL.id}`, async (route) => {
    patches.push(route.request().postDataJSON());
    if (patches.length === 1) await responseReady;
    // Forward to the session-isolated fixture; subsequent RSC refreshes read the saved motel.
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  await page.goto("/motels");
  const trigger = page.getByRole("button", { name: `Chỉnh sửa ${MOTEL.name}`, exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa nhà trọ" });
  await dialog.getByLabel("Tên nhà trọ", { exact: true }).fill("Nhà trọ A");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect.poll(() => patches.length).toBe(1);
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await expect(dialog.getByLabel("Tên nhà trọ", { exact: true })).toHaveValue(MOTEL.name);
  release();
  await expect(page.getByText("Đã lưu thay đổi nhà trọ", { exact: true })).toBeVisible();
  await expect(page.locator(`#motel-${MOTEL.id}`)).toHaveText("Nhà trọ A");
  await expect(page.locator(`#motel-selector option[value="${MOTEL.id}"]`)).toHaveText("Nhà trọ A");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Tên nhà trọ", { exact: true })).toHaveValue(MOTEL.name);
  await dialog.getByLabel("Giá nước (₫/m³)", { exact: true }).fill("25.000");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  expect(patches).toEqual([{ name: "Nhà trọ A" }, { waterPrice: "25000" }]);
  await expect(page.locator(`#motel-${MOTEL.id}`)).toHaveText("Nhà trọ A");
  await expect(page.locator(`#motel-selector option[value="${MOTEL.id}"]`)).toHaveText("Nhà trọ A");
});

test("an expired session during save returns to login", async ({ page, context }) => {
  await signIn(context);
  await page.route(`**/api/manager/motels/${MOTEL.id}`, (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Chưa đăng nhập", code: "UNAUTHORIZED" }) }));
  await page.goto("/motels");
  await page.getByRole("button", { name: `Chỉnh sửa ${MOTEL.name}`, exact: true }).click();
  await page.getByRole("dialog", { name: "Chỉnh sửa nhà trọ" }).getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page).toHaveURL("/login");
});
