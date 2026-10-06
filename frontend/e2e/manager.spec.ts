import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { MANAGER_ME, MOTEL, MOTEL_WITHOUT_EXTRAS, ROOM, RENTER } from "../src/lib/api/__tests__/fixtures";

const origin = "http://localhost:3001";
async function signIn(context: BrowserContext, scenario = "manager") {
  await context.addCookies([{ name: "manager_session", value: `${scenario}-${crypto.randomUUID()}`, url: origin, httpOnly: true, sameSite: "Lax" }]);
}
async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}
async function keyboardActivate(page: Page, target: Locator) {
  // Reach the target by real Tab movement; focus() alone cannot expose negative tabindex bugs.
  for (let step = 0; step < 150; step += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) {
      await page.keyboard.press("Enter"); return;
    }
  }
  throw new Error(`Action was not reachable by Tab: ${await target.innerText()}`);
}

test("login through the proxy opens M1–M4 at 375px and logout protects the shell again", async ({ page, context }) => {
  await page.goto("/rooms");
  await expect(page).toHaveURL("/login");
  await page.getByLabel("Email", { exact: true }).fill(MANAGER_ME.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password123");
  await keyboardActivate(page, page.getByRole("button", { name: "Đăng nhập", exact: true }));
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
  await expect(page.getByText("1 đang thuê · 1 trống · 0 bảo trì", { exact: true })).toBeVisible();
  await expect(page.getByText("Tỷ lệ lấp đầy: 50%", { exact: true })).toBeVisible();
  expect((await context.cookies()).find((cookie) => cookie.name === "manager_session")?.httpOnly).toBe(true);
  const nav = page.getByRole("navigation", { name: "Điều hướng chính trên điện thoại" });
  await noPageOverflow(page);
  for (const [name, path] of [["Nhà trọ", "/motels"], ["Phòng trọ", "/rooms"], ["Khách thuê", "/renters"], ["Tổng quan", "/"]]) {
    await keyboardActivate(page, nav.getByRole("link", { name, exact: true }));
    await expect(page).toHaveURL(`${path}?motel=${MOTEL.id}`);
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await noPageOverflow(page);
  }
  await keyboardActivate(page, page.getByLabel("Menu phụ, Tài khoản", { exact: true }));
  await keyboardActivate(page, page.getByRole("button", { name: "Đăng xuất", exact: true }));
  await expect(page).toHaveURL("/login");
  expect((await context.cookies()).some((cookie) => cookie.name === "manager_session")).toBe(false);
  await page.goto(`/renters?motel=${MOTEL.id}`);
  await expect(page).toHaveURL("/login");
});

test("motel and room create/edit persist through refresh and scope the renter form", async ({ page, context }) => {
  await signIn(context, "no-motels");
  await page.goto("/motels");
  await expect(page.getByRole("heading", { name: "Chưa có nhà trọ", exact: true })).toBeVisible();
  await keyboardActivate(page, page.getByRole("button", { name: "Tạo nhà trọ", exact: true }));
  const motelDialog = page.getByRole("dialog", { name: "Tạo nhà trọ", exact: true });
  await motelDialog.getByLabel("Tên nhà trọ", { exact: true }).fill("Nhà trọ mới");
  await motelDialog.getByLabel("Giá điện (₫/kWh)", { exact: true }).fill("3500");
  await motelDialog.getByLabel("Giá nước (₫/m³)", { exact: true }).fill("25000");
  await keyboardActivate(page, motelDialog.getByRole("button", { name: "Tạo nhà trọ", exact: true }));
  await expect(motelDialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Nhà trọ mới", exact: true })).toBeVisible();
  const motelId = await page.getByLabel("Nhà trọ", { exact: true }).inputValue();
  await page.getByRole("button", { name: "Chỉnh sửa Nhà trọ mới", exact: true }).click();
  const editMotel = page.getByRole("dialog", { name: "Chỉnh sửa nhà trọ", exact: true });
  await editMotel.getByLabel("Tên nhà trọ", { exact: true }).fill("Nhà trọ đã lưu");
  await editMotel.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nhà trọ đã lưu", exact: true })).toBeVisible();
  await page.goto(`/rooms?motel=${motelId}`);
  await expect(page.getByRole("heading", { name: "Chưa có phòng trọ", exact: true })).toBeVisible();
  await keyboardActivate(page, page.getByRole("button", { name: "Thêm phòng", exact: true }));
  const roomDialog = page.getByRole("dialog", { name: "Thêm phòng trọ", exact: true });
  await roomDialog.getByLabel("Tên phòng", { exact: true }).fill("P.001 mới");
  await roomDialog.getByLabel("Tầng (không bắt buộc)", { exact: true }).fill("0");
  await roomDialog.getByLabel("Giá thuê cơ bản (₫/tháng)", { exact: true }).fill("99999999999999");
  await roomDialog.getByRole("button", { name: "Thêm phòng", exact: true }).click();
  await expect(page.getByRole("heading", { name: "P.001 mới", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chỉnh sửa P.001 mới", exact: true }).click();
  const editRoom = page.getByRole("dialog", { name: "Chỉnh sửa phòng trọ", exact: true });
  await editRoom.getByLabel("Tên phòng", { exact: true }).fill("P.001 đã lưu");
  await editRoom.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByRole("heading", { name: "P.001 đã lưu", exact: true })).toBeVisible();
  await page.reload();
  const amount = page.getByText("99.999.999.999.999 ₫", { exact: true });
  await expect(amount).toBeVisible();
  expect(await amount.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("nowrap");
  await noPageOverflow(page);
  await page.goto(`/?motel=${motelId}`);
  await keyboardActivate(page, page.getByRole("link", { name: "Thêm khách thuê", exact: true }));
  const renterDialog = page.getByRole("dialog", { name: "Thêm khách thuê", exact: true });
  await expect(renterDialog).toBeVisible();
  await expect(renterDialog.getByLabel("Phòng (không bắt buộc)", { exact: true }).getByRole("option", { name: "P.001 đã lưu", exact: true })).toHaveCount(1);
});

test("renter create/edit validates locally, preserves CCCD zeros, unassigns and survives reload", async ({ page, context }) => {
  await signIn(context);
  await page.goto(`/renters?motel=${MOTEL.id}`);
  const trigger = page.getByRole("button", { name: "Thêm khách thuê", exact: true });
  await keyboardActivate(page, trigger);
  const dialog = page.getByRole("dialog", { name: "Thêm khách thuê", exact: true });
  await dialog.getByRole("button", { name: "Thêm khách thuê", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeFocused();
  await expect(dialog.getByLabel("Họ tên", { exact: true })).toHaveAccessibleDescription("Nhập họ tên");
  await dialog.getByRole("link", { name: "Nhập họ tên", exact: true }).click();
  await expect(dialog.getByLabel("Họ tên", { exact: true })).toBeFocused();
  await dialog.getByLabel("Họ tên", { exact: true }).fill(" Nguyễn Thị An ");
  await dialog.getByLabel("Số điện thoại", { exact: true }).fill("0903333333");
  await dialog.getByLabel("Số CCCD (không bắt buộc)", { exact: true }).fill("00001234");
  await dialog.getByLabel("Phòng (không bắt buộc)", { exact: true }).selectOption(ROOM.id);
  await keyboardActivate(page, dialog.getByRole("button", { name: "Thêm khách thuê", exact: true }));
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  const row = page.getByRole("row").filter({ hasText: "Nguyễn Thị An" });
  await expect(row).toContainText("+84 903 333 333");
  await expect(row).toContainText("00001234");
  await expect(row).toContainText("Đang thuê");
  await expect(row).toContainText("Chưa follow");
  const edit = row.getByRole("button", { name: "Chỉnh sửa Nguyễn Thị An", exact: true });
  await keyboardActivate(page, edit);
  const editDialog = page.getByRole("dialog", { name: "Chỉnh sửa khách thuê", exact: true });
  await editDialog.getByLabel("Họ tên", { exact: true }).fill("Bản nháp");
  await page.keyboard.press("Escape");
  await expect(edit).toBeFocused();
  await edit.click();
  await expect(editDialog.getByLabel("Họ tên", { exact: true })).toHaveValue("Nguyễn Thị An");
  await editDialog.getByLabel("Họ tên", { exact: true }).fill("Nguyễn Thị An đã lưu");
  await editDialog.getByLabel("Số CCCD (không bắt buộc)", { exact: true }).fill("");
  await editDialog.getByLabel("Phòng (không bắt buộc)", { exact: true }).selectOption("");
  await editDialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(editDialog).not.toBeVisible();
  await page.reload();
  const saved = page.getByRole("row").filter({ hasText: "Nguyễn Thị An đã lưu" });
  await expect(saved).toContainText("Chưa xếp phòng");
  await expect(saved).toContainText("Chưa cập nhật");
  await saved.getByRole("link", { name: "Xem Nguyễn Thị An đã lưu", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nguyễn Thị An đã lưu", exact: true })).toBeVisible();
  await noPageOverflow(page);
});

test("renter duplicate 409 retains the draft with a focused banner", async ({ page, context }) => {
  await signIn(context);
  await page.goto(`/renters?motel=${MOTEL.id}`);
  await page.getByRole("button", { name: "Thêm khách thuê", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm khách thuê", exact: true });
  await dialog.getByLabel("Họ tên", { exact: true }).fill("Tên mới");
  await dialog.getByLabel("Số điện thoại", { exact: true }).fill(RENTER.phone);
  await dialog.getByRole("button", { name: "Thêm khách thuê", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeFocused();
  await expect(dialog.getByRole("alert")).toContainText("Số điện thoại đã tồn tại");
  await expect(dialog.getByLabel("Họ tên", { exact: true })).toHaveValue("Tên mới");
  await expect(dialog.getByLabel("Họ tên", { exact: true })).not.toHaveAttribute("aria-invalid", "true");
});

test("a Server Component 500 renders retry guidance without showing private backend text", async ({ page, context }) => {
  await signIn(context, "rooms-error");
  await page.goto(`/?motel=${MOTEL.id}`);
  await expect(page.getByRole("heading", { name: "Không thể tải nội dung", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).not.toContainText("private database host");
  await keyboardActivate(page, page.getByRole("button", { name: "Thử lại", exact: true }));
  await expect(page.getByRole("heading", { name: "Không thể tải nội dung", exact: true })).toBeVisible();
  await noPageOverflow(page);
});

test("empty room and renter screens keep scoped creation reachable", async ({ page, context }) => {
  await signIn(context);
  await page.goto(`/?motel=${MOTEL_WITHOUT_EXTRAS.id}`);
  await expect(page.getByText("Tỷ lệ lấp đầy: 0%", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Xem phòng trọ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chưa có phòng trọ", exact: true })).toBeVisible();
  await page.goto(`/renters?motel=${MOTEL_WITHOUT_EXTRAS.id}`);
  await expect(page.getByRole("heading", { name: "Chưa có khách thuê", exact: true })).toBeVisible();
  await keyboardActivate(page, page.getByRole("button", { name: "Thêm khách thuê", exact: true }));
  await expect(page.getByRole("dialog", { name: "Thêm khách thuê", exact: true })).toBeVisible();
  await noPageOverflow(page);
});

for (const [title, path] of [["Tổng quan", "/"], ["Nhà trọ", "/motels"], ["Phòng trọ", "/rooms"], ["Khách thuê", "/renters"]]) {
  test(`${title}: every enabled visible action is reachable by Tab with unobscured focus`, async ({ page, context }) => {
    await signIn(context);
    await page.goto(`${path}?motel=${MOTEL.id}`);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    const selector = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary';
    const actions = page.locator(selector);
    const indices = await actions.evaluateAll((elements) => elements.flatMap((element, index) => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden" ? [index] : []));
    const remaining = new Set(indices);
    for (let step = 0; step < indices.length * 3 && remaining.size; step += 1) {
      await page.keyboard.press("Tab");
      const index = await actions.evaluateAll((elements) => elements.indexOf(document.activeElement as HTMLElement));
      if (!remaining.has(index)) continue;
      remaining.delete(index);
      const focused = actions.nth(index);
      const geometry = await focused.evaluate((element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const outlineExtent = style.outlineStyle === "none" ? 0 : Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset));
        const painted = { left: rect.left - outlineExtent, right: rect.right + outlineExtent,
          top: rect.top - outlineExtent, bottom: rect.bottom + outlineExtent };
        const covers = [...document.querySelectorAll<HTMLElement>("header, aside, nav")].filter((chrome) => !chrome.contains(element) && ["sticky", "fixed"].includes(getComputedStyle(chrome).position)).map((chrome) => chrome.getBoundingClientRect());
        let clipped = false;
        for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const overflow = getComputedStyle(ancestor);
          if (![overflow.overflow, overflow.overflowX, overflow.overflowY].some((value) => ["auto", "hidden", "clip", "scroll"].includes(value))) continue;
          const boundary = ancestor.getBoundingClientRect();
          if (painted.left < boundary.left || painted.right > boundary.right || painted.top < boundary.top || painted.bottom > boundary.bottom) { clipped = true; break; }
        }
        return { visible: painted.left >= 0 && painted.right <= innerWidth && painted.top >= 0 && painted.bottom <= innerHeight,
          obscured: covers.some((cover) => cover.width > 0 && painted.left < cover.right && painted.right > cover.left && painted.top < cover.bottom && painted.bottom > cover.top),
          clipped, ring: outlineExtent > 0 };
      });
      expect(geometry.visible).toBe(true);
      expect(geometry.obscured).toBe(false);
      expect(geometry.clipped).toBe(false);
      expect(geometry.ring).toBe(true);
    }
    expect([...remaining], "actions unreachable by Tab").toEqual([]);
    await noPageOverflow(page);
  });
}
