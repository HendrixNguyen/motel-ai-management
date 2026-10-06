import { expect, test, type BrowserContext } from "@playwright/test";
import { MOTEL, ROOM, RENTER } from "../src/lib/api/__tests__/fixtures";

async function signIn(context: BrowserContext, session = "valid") {
  await context.addCookies([{ name: "manager_session", value: session, url: "http://localhost:3001", httpOnly: true, sameSite: "Lax" }]);
}

test("room filters survive reload and clearing them keeps motel scope at 360px", async ({ page, context }) => {
  await signIn(context);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`/rooms?motel=${MOTEL.id}`);
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: ROOM.name, exact: true }) });
  await expect(card).toContainText("3.500.000 ₫");
  await expect(card).toContainText(RENTER.name);
  await expect(card.getByRole("link", { name: "Xem khách thuê" })).toHaveAttribute("href", `/renters?motel=${MOTEL.id}&roomId=${ROOM.id}`);
  await page.getByLabel("Tầng", { exact: true }).fill("0");
  await page.getByLabel("Trạng thái", { exact: true }).selectOption("available");
  await page.getByLabel("Tìm theo tên phòng", { exact: true }).fill("P.001");
  await page.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
  await expect(page).toHaveURL(`/rooms?motel=${MOTEL.id}&floor=0&status=available&search=P.001`);
  await expect(page.getByRole("heading", { name: "Không có phòng phù hợp" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Tầng", { exact: true })).toHaveValue("0");
  await expect(page.getByLabel("Trạng thái", { exact: true })).toHaveValue("available");
  await expect(page.getByLabel("Tìm theo tên phòng", { exact: true })).toHaveValue("P.001");
  await page.getByRole("link", { name: "Xóa bộ lọc" }).first().click();
  await expect(page).toHaveURL(`/rooms?motel=${MOTEL.id}`);
  await expect(card).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("room creation focuses linked local errors then sends exact VND with floor zero", async ({ page, context }) => {
  await signIn(context);
  await page.setViewportSize({ width: 360, height: 740 });
  let input: unknown;
  await page.route(`**/api/manager/motels/${MOTEL.id}/rooms`, async (route) => {
    input = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(ROOM) });
  });
  await page.goto(`/rooms?motel=${MOTEL.id}`);
  const trigger = page.getByRole("button", { name: "Thêm phòng", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Thêm phòng trọ" });
  await dialog.getByRole("button", { name: "Thêm phòng", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeFocused();
  await expect(dialog.getByLabel("Tên phòng", { exact: true })).toHaveAccessibleDescription("Nhập tên phòng");
  await dialog.getByRole("link", { name: "Nhập tên phòng", exact: true }).click();
  await expect(dialog.getByLabel("Tên phòng", { exact: true })).toBeFocused();
  await dialog.getByLabel("Tên phòng", { exact: true }).fill(" P.102 ");
  await dialog.getByLabel("Tầng (không bắt buộc)", { exact: true }).fill("0");
  await dialog.getByLabel("Giá thuê cơ bản (₫/tháng)", { exact: true }).fill("003500000");
  await expect(dialog.getByText("3.500.000 ₫", { exact: true })).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Thêm phòng", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(input).toEqual({ name: "P.102", basePrice: "3500000", floor: 0 });
  await expect(page.getByText("Đã thêm phòng trọ", { exact: true })).toBeVisible();
});

test("editing clears floor with a partial PATCH and cancellation discards the draft", async ({ page, context }) => {
  await signIn(context);
  const inputs: unknown[] = [];
  await page.route(`**/api/manager/motels/${MOTEL.id}/rooms/${ROOM.id}`, async (route) => {
    inputs.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(ROOM) });
  });
  await page.goto(`/rooms?motel=${MOTEL.id}`);
  const trigger = page.getByRole("button", { name: `Chỉnh sửa ${ROOM.name}`, exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa phòng trọ" });
  await expect(dialog.getByLabel("Giá thuê cơ bản (₫/tháng)", { exact: true })).toHaveValue("3.500.000");
  await dialog.getByLabel("Tầng (không bắt buộc)", { exact: true }).fill("");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  expect(inputs).toEqual([{ floor: null }]);
  await trigger.click();
  await dialog.getByLabel("Tên phòng", { exact: true }).fill("Bản nháp");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByLabel("Tên phòng", { exact: true })).toHaveValue(ROOM.name);
  expect(inputs).toHaveLength(1);
});

test("status action submits only status and disables controls while pending", async ({ page, context }) => {
  await signIn(context);
  const inputs: unknown[] = [];
  let release!: () => void;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/manager/motels/${MOTEL.id}/rooms/${ROOM.id}`, async (route) => {
    inputs.push(route.request().postDataJSON());
    await ready;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ...ROOM, status: "maintenance" }) });
  });
  await page.goto(`/rooms?motel=${MOTEL.id}`);
  await page.getByRole("button", { name: `Đổi trạng thái ${ROOM.name}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Đổi trạng thái phòng" });
  await dialog.getByLabel("Trạng thái phòng", { exact: true }).selectOption("maintenance");
  await dialog.getByRole("button", { name: "Lưu trạng thái" }).click();
  await expect(dialog.getByLabel("Trạng thái phòng", { exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
  await expect.poll(() => inputs.length).toBe(1);
  release();
  await expect(dialog).not.toBeVisible();
  expect(inputs).toEqual([{ status: "maintenance" }]);
  await expect(page.getByText("Đã đổi trạng thái phòng", { exact: true })).toBeVisible();
});

for (const [status, code] of [[409, "CONFLICT"], [400, "VALIDATION_ERROR"], [404, "NOT_FOUND"]] as const) {
  test(`room HTTP ${status} preserves draft and renders an accessible form banner`, async ({ page, context }) => {
    await signIn(context);
    await page.route(`**/api/manager/motels/${MOTEL.id}/rooms/${ROOM.id}`, (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: 'Phòng "P.102" đã tồn tại trong nhà trọ này', code }) }));
    await page.goto(`/rooms?motel=${MOTEL.id}`);
    await page.getByRole("button", { name: `Chỉnh sửa ${ROOM.name}`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Chỉnh sửa phòng trọ" });
    await dialog.getByLabel("Tên phòng", { exact: true }).fill("P.102");
    await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(dialog.getByRole("alert")).toContainText('Phòng "P.102"');
    await expect(dialog.getByRole("alert")).toBeFocused();
    await expect(dialog.getByLabel("Tên phòng", { exact: true })).toHaveValue("P.102");
    await expect(dialog.getByLabel("Tên phòng", { exact: true })).not.toHaveAttribute("aria-invalid", "true");
    if (status === 404) {
      await dialog.getByRole("button", { name: "Tải lại danh sách" }).click();
      await expect(dialog).not.toBeVisible();
    }
  });
}

test("dismissed pending edit cannot close a reopened dialog or rewrite its untouched baseline", async ({ page, context }) => {
  await signIn(context, `room-refresh-${crypto.randomUUID()}`);
  const inputs: unknown[] = [];
  let release!: () => void;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/manager/motels/${MOTEL.id}/rooms/${ROOM.id}`, async (route) => {
    inputs.push(route.request().postDataJSON());
    if (inputs.length === 1) await ready;
    await route.fulfill({ response: await route.fetch() });
  });
  await page.goto(`/rooms?motel=${MOTEL.id}`);
  const trigger = page.getByRole("button", { name: `Chỉnh sửa ${ROOM.name}`, exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa phòng trọ" });
  await dialog.getByLabel("Tên phòng", { exact: true }).fill("P.201");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect.poll(() => inputs.length).toBe(1);
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  release();
  await expect(page.locator(`#room-${ROOM.id}`)).toHaveText("P.201");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Tên phòng", { exact: true })).toHaveValue(ROOM.name);
  await dialog.getByLabel("Giá thuê cơ bản (₫/tháng)", { exact: true }).fill("4000000");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  expect(inputs).toEqual([{ name: "P.201" }, { basePrice: "4000000" }]);
  await expect(page.locator(`#room-${ROOM.id}`)).toHaveText("P.201");
});

test("an expired session during a room save returns to login", async ({ page, context }) => {
  await signIn(context);
  await page.route(`**/api/manager/motels/${MOTEL.id}/rooms/${ROOM.id}`, (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Chưa đăng nhập", code: "UNAUTHORIZED" }) }));
  await page.goto(`/rooms?motel=${MOTEL.id}`);
  await page.getByRole("button", { name: `Chỉnh sửa ${ROOM.name}`, exact: true }).click();
  await page.getByRole("dialog", { name: "Chỉnh sửa phòng trọ" }).getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page).toHaveURL("/login");
});
