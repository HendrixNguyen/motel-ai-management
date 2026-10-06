import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

// Proves the harness: Chromium launches, `next dev` is reachable at 375x667, and a fixture answers
// the proxied API path with no PostgreSQL and no Elysia backend running. Real specs replace this
// from Task 5 onwards; nothing here should grow past the harness it verifies.
//
// There is no `/` route yet — Task 10 creates `app/(manager)/page.tsx` — so this navigates to a
// path that does not exist and asserts on the one thing that is genuinely there: the root layout's
// `lang="vi"` on Next's not-found document.
const NOT_A_ROUTE = "/khong-ton-tai-smoke";

test("the dev server serves the Vietnamese root layout at 375px", async ({ page }) => {
  expect(page.viewportSize()).toEqual({ width: 375, height: 667 });

  const response = await page.goto(NOT_A_ROUTE);

  expect(response?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
});

test("a fixture answers the api path with no backend running", async ({ page }) => {
  const requested = await mockApi(page, { "GET /api/manager/motels": [] });
  await page.goto(NOT_A_ROUTE);

  const body = await page.evaluate(() => fetch("/api/manager/motels").then((r) => r.json()));

  expect(body).toEqual([]);
  expect(requested).toEqual(["GET /api/manager/motels"]);
});
