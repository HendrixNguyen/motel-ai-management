import { expect, test } from "@playwright/test";
import { validateLiveQaConfig } from "../../src/lib/real-qa-safety";

const configErrors = validateLiveQaConfig(process.env);

test.beforeEach(async ({ page, request }) => {
  expect(configErrors, "Live QA preflight rejected configuration").toEqual([]);
  const response = await request.get(`${process.env.BACKEND_URL}/api/auth/me`);
  expect(response.status(), "A reachable live backend must reject an anonymous identity read").toBe(401);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_LOGIN_EMAIL!);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(process.env.E2E_LOGIN_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
});

test("contract create/send UI is blocked: controls absent", async ({ page }) => {
  await page.goto("/contracts");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Tạo hợp đồng|Gửi hợp đồng/ })).toHaveCount(0);
  test.info().annotations.push({
    type: "blocked",
    description: "Contract create/send controls are absent; billing/payment journey remains unverified.",
  });
});

test("billing and payment journey remains explicitly skipped without QA setup", async () => {
  test.skip(true, "No safe UI setup or confirmed QA credentials/isolation.");
});
