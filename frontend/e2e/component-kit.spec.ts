import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

let html: string;
test.beforeAll(() => {
  // Build before this suite: CSS comes from the real Tailwind production output,
  // and includes every scanned primitive even before a product screen uses it.
  const cssDirectory = join(process.cwd(), ".next/static/chunks");
  const css = readdirSync(cssDirectory).filter((file) => file.endsWith(".css")).map((file) => readFileSync(join(cssDirectory, file), "utf8")).join("\n");
  const script = execFileSync(process.env.BUN_EXECUTABLE ?? "bun", ["build", "e2e/fixtures/component-kit.tsx", "--target=browser", "--format=iife"], { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
  html = `<!doctype html><html lang="vi"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body class="bg-canvas text-text-body"><div id="kit"></div><script>${script.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
});

test.beforeEach(async ({ page }) => {
  await page.route("**/__component-kit", (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
  await page.goto("/__component-kit");
});

for (const [trigger, title] of [["Mở modal", "Sửa phòng"], ["Mở drawer", "Chi tiết khách thuê"]]) {
  test(`${trigger} traps focus and returns focus after Escape or explicit close`, async ({ page }) => {
    const button = page.getByRole("button", { name: trigger, exact: true });
    const dialog = page.getByRole("dialog", { name: title });
    await button.click();
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate((element) => getComputedStyle(element).animationName)).not.toBe("none");
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(button).toBeFocused();
    await button.click();
    await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(button).toBeFocused();
  });
}

test("controlled modal close restores its trigger", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Mở modal", exact: true });
  await trigger.click();
  await page.getByRole("dialog").getByRole("button", { name: "Lưu phòng" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("table searches internally, sorts BigInt money, and paginates", async ({ page }) => {
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await page.getByRole("button", { name: "Tiền thuê — Sắp xếp" }).click();
  await expect(page.getByRole("columnheader", { name: "Tiền thuê — Sắp xếp" })).toHaveAttribute("aria-sort", "ascending");
  await expect(rows.first()).toContainText("Chi");
  await expect(rows.last()).toContainText("Bình");
  await page.getByRole("button", { name: "Trang sau" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Ánh");
  await expect(page.getByRole("button", { name: "Trang sau" })).toBeDisabled();
  await page.getByLabel("Tìm kiếm", { exact: true }).fill("  BÌNH ");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Bình");
  await expect(page.getByRole("button", { name: "Trang trước" })).toBeDisabled();
  await page.getByLabel("Tìm kiếm", { exact: true }).fill("không tìm thấy");
  await expect(page.getByText("Không có kết quả. Thử thay đổi từ khóa hoặc bộ lọc.")).toBeVisible();
});

test("tabs use ARIA relationships and roving keyboard navigation", async ({ page }) => {
  const tabs = page.getByRole("tab");
  const firstTab = tabs.nth(0);
  const panelId = await firstTab.getAttribute("aria-controls");
  expect(panelId).toMatch(/-one-panel$/);
  await expect(firstTab).toHaveAttribute("id", new RegExp(`-${"one"}-tab$`));
  await expect(page.locator(`#${panelId}`)).toHaveAttribute("aria-labelledby", await firstTab.getAttribute("id") ?? "");
  await tabs.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(tabs.nth(2)).toBeFocused();
  await page.keyboard.press("Home");
  await expect(tabs.nth(0)).toBeFocused();
});

test("accordion keeps closed content relationship and progress exposes normalized semantics", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Chi tiết", exact: true });
  await expect(trigger).toHaveAttribute("aria-controls", "details-content");
  await expect(page.locator("#details-content")).toBeHidden();
  await trigger.click();
  await expect(page.locator("#details-content")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Hoàn tất" })).toHaveAttribute("aria-valuenow", "40");
});

test("copy success and failure produce truthful visible feedback", async ({ page }) => {
  await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { (window as unknown as { copied: string }).copied = value; } } }); });
  await page.getByRole("button", { name: "Sao chép", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã sao chép" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe("https://example.test/r/token");
  await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Permission denied"); } } }); });
  await page.getByRole("button", { name: "Sao chép", exact: true }).click();
  await expect(page.getByText("Không thể sao chép. Hãy chọn và sao chép nội dung thủ công.")).toBeVisible();
  await expect(page.getByText("Đã sao chép", { exact: true })).not.toBeVisible();
});

test("toast auto-dismisses normal messages and preserves critical errors", async ({ page }) => {
  await page.getByRole("button", { name: "Thông báo", exact: true }).click();
  const normal = page.getByRole("status", { name: "Đã lưu phòng" });
  await expect(normal).toBeVisible();
  await expect(normal).toHaveAttribute("aria-live", "polite");
  await expect.poll(() => normal.evaluate((element) => getComputedStyle(element).animationName)).not.toBe("none");
  await expect(normal).toHaveAttribute("aria-atomic", "true");
  await expect(normal).toHaveAccessibleName("Đã lưu phòng");
  await expect(normal.locator("p")).toHaveAttribute("id", /toast-message-\d+/);
  await expect(normal).not.toHaveAttribute("aria-label");
  await expect(normal).toBeHidden({ timeout: 3500 });
  await page.getByRole("button", { name: "Thông báo lỗi", exact: true }).click();
  const critical = page.getByRole("alert", { name: "Lỗi nghiêm trọng" });
  await expect(critical).toBeVisible();
  await expect(critical).toHaveAttribute("aria-live", "assertive");
  await expect(critical).toHaveAttribute("aria-atomic", "true");
  await expect(critical).toHaveAccessibleName("Lỗi nghiêm trọng");
  await expect(critical.locator("p")).toHaveAttribute("id", /toast-message-\d+/);
  await expect(critical).not.toHaveAttribute("aria-label");
  await page.waitForTimeout(3500);
  await expect(critical).toBeVisible();
  await critical.getByRole("button", { name: "Đóng thông báo: Lỗi nghiêm trọng" }).click();
  await expect(critical).toBeHidden();
});

test("confirm dialog cancels, closes on Escape, and exposes pending confirmation", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Xác nhận xóa", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Xóa phòng" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Hủy", exact: true }).press("Enter");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("button", { name: "Xác nhận", exact: true }).press("Enter");
  await expect(dialog.getByRole("button", { name: "Đang xử lý…", exact: true })).toBeDisabled();
  await expect(dialog).toBeVisible();
});

test("dialogs and toasts fit and remain interactive across viewport themes", async ({ page }) => {
  for (const width of [360, 375, 430, 1280]) {
    for (const theme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 740 });
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

      const modalTrigger = page.getByRole("button", { name: "Mở modal", exact: true });
      await modalTrigger.click();
      const modal = page.getByRole("dialog", { name: "Sửa phòng" });
      const modalBox = await modal.boundingBox();
      expect(modalBox).not.toBeNull();
      expect(modalBox!.x).toBeGreaterThanOrEqual(0);
      expect(modalBox!.x + modalBox!.width).toBeLessThanOrEqual(width);
      expect(modalBox!.width).toBeGreaterThanOrEqual(Math.min(width - 32, 320));
      const input = modal.getByRole("textbox", { name: "Tên phòng" });
      const inputBox = await input.boundingBox();
      expect(inputBox).not.toBeNull();
      const inputReceivesPointer = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y) instanceof HTMLInputElement, {
        x: inputBox!.x + inputBox!.width / 2,
        y: inputBox!.y + inputBox!.height / 2,
      });
      expect(inputReceivesPointer).toBe(true);
      await input.click();
      await expect(input).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(modal).toBeHidden();

      const drawerTrigger = page.getByRole("button", { name: "Mở drawer", exact: true });
      await drawerTrigger.click();
      const drawer = page.getByRole("dialog", { name: "Chi tiết khách thuê" });
      const drawerBox = await drawer.boundingBox();
      expect(drawerBox).not.toBeNull();
      expect(drawerBox!.width).toBeGreaterThanOrEqual(Math.min(width, 320));
      expect(drawerBox!.x).toBeGreaterThanOrEqual(0);
      expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(width);
      await drawer.getByRole("button", { name: "Đóng", exact: true }).click();
      await expect(drawer).toBeHidden();

      await page.getByRole("button", { name: "Thông báo", exact: true }).click();
      const toast = page.getByRole("status", { name: "Đã lưu phòng" });
      await expect(toast).toBeVisible();
      const toastBox = await toast.boundingBox();
      expect(toastBox).not.toBeNull();
      expect(toastBox!.width).toBeGreaterThanOrEqual(Math.min(width - 32, 320));
      expect(toastBox!.x).toBeGreaterThanOrEqual(0);
      expect(toastBox!.x + toastBox!.width).toBeLessThanOrEqual(width);
      await toast.getByRole("button", { name: "Đóng thông báo: Đã lưu phòng" }).click();
      await expect(toast).toBeHidden();
    }
  }
});

test("mobile table rows and reduced motion stay usable without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 667 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Mở modal", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sửa phòng" });
  await expect.poll(() => dialog.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Thông báo", exact: true }).click();
  await expect.poll(() => page.getByRole("status", { name: "Đã lưu phòng" }).evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await page.getByRole("status", { name: "Đã lưu phòng" }).getByRole("button").click();
  expect(await page.locator('[role="status"] [aria-hidden="true"]').evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await page.locator("tbody tr").first().evaluate((element) => getComputedStyle(element).display)).toBe("block");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const button of await page.getByRole("button").all()) {
    const rect = await button.boundingBox();
    if (rect) { expect(rect.height).toBeGreaterThanOrEqual(44); expect(rect.width).toBeGreaterThanOrEqual(44); }
  }
  const trigger = page.getByRole("button", { name: "Mở drawer", exact: true });
  await page.keyboard.press("Tab");
  while (!(await trigger.evaluate((element) => element === document.activeElement))) await page.keyboard.press("Tab");
  expect(await trigger.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
  await trigger.click();
  expect(await page.getByRole("dialog").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await page.locator("tbody tr").first().evaluate((element) => getComputedStyle(element).display)).toBe("table-row");
  expect(await page.locator('td[data-label="Tiền thuê"]').first().evaluate((element) => getComputedStyle(element).fontVariantNumeric)).toContain("tabular-nums");
});
