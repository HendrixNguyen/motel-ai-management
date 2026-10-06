import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

// Proves the harness: Chromium launches, `next dev` is reachable at 375x667, and a fixture answers
// the proxied API path with no PostgreSQL and no Elysia backend running. Task 5's shell specs cover
// the manager flows; these checks stay limited to the harness.
//
// A path outside the manager routes verifies the root layout's `lang="vi"` on the not-found
// document without requiring a manager session.
const NOT_A_ROUTE = "/khong-ton-tai-smoke";

test("the dev server serves the Vietnamese root layout at 375px", async ({ page }) => {
  expect(page.viewportSize()).toEqual({ width: 375, height: 667 });

  const response = await page.goto(NOT_A_ROUTE);

  expect(response?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
});

test("a fixture answers the api path with no backend running", async ({ page }) => {
  const requested = await mockApi(page, { "GET /api/manager/motels": [] });
  await page.goto(NOT_A_ROUTE);

  const body = await page.evaluate(() => fetch("/api/manager/motels").then((r) => r.json()));

  expect(body).toEqual([]);
  expect(requested).toEqual(["GET /api/manager/motels"]);
});
