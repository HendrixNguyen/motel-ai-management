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

test("toast can be announced and dismissed with a keyboard", async ({ page }) => {
  await page.getByRole("button", { name: "Thông báo", exact: true }).click();
  await expect(page.locator('[aria-live="polite"]')).toContainText("Đã lưu phòng");
  const dismiss = page.getByRole("button", { name: "Đóng thông báo: Đã lưu phòng", exact: true });
  await dismiss.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Đã lưu phòng", { exact: true })).not.toBeVisible();
});

test("mobile table rows and reduced motion stay usable without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 667 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator("tbody tr").first().evaluate((element) => getComputedStyle(element).display)).toBe("block");
  expect(await page.locator('[role="status"] [aria-hidden="true"]').evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const button of await page.getByRole("button").all()) {
    const rect = await button.boundingBox();
    if (rect) { expect(rect.height).toBeGreaterThanOrEqual(44); expect(rect.width).toBeGreaterThanOrEqual(44); }
  }
  const trigger = page.getByRole("button", { name: "Mở drawer", exact: true });
  await trigger.focus();
  expect(await trigger.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
  await trigger.click();
  expect(await page.getByRole("dialog").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await page.locator("tbody tr").first().evaluate((element) => getComputedStyle(element).display)).toBe("table-row");
  expect(await page.locator('td[data-label="Tiền thuê"]').first().evaluate((element) => getComputedStyle(element).fontVariantNumeric)).toContain("tabular-nums");
});
