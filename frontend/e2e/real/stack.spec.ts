import { expect, test } from "@playwright/test";

// Selected only by E2E_REAL=1. Missing prerequisites fail loudly; no test.skip().
test.beforeAll(async ({ request }) => {
  for (const name of ["BACKEND_URL", "E2E_LOGIN_EMAIL", "E2E_LOGIN_PASSWORD"]) {
    expect(process.env[name], `Set ${name} for the gated live-stack suite; see docs/testing-strategy.md`).toBeTruthy();
  }
  const backend = process.env.BACKEND_URL!;
  const response = await request.get(`${backend}/api/auth/me`);
  expect(response.status(), "A reachable live backend must reject an anonymous identity read").toBe(401);
});

test("live manager login forwards the httpOnly cookie, opens the shell and logs out", async ({ page, context }) => {
  await page.goto("/rooms");
  await expect(page).toHaveURL("/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_LOGIN_EMAIL!);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(process.env.E2E_LOGIN_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
  const cookie = (await context.cookies()).find((entry) => entry.name === "manager_session");
  expect(cookie?.httpOnly).toBe(true);
  const identity = await page.request.get("/api/auth/me");
  expect(identity.status()).toBe(200);
  expect((await identity.json() as { email: string }).email).toBe(process.env.E2E_LOGIN_EMAIL);
  await page.getByLabel("Menu phụ, Tài khoản", { exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL("/login");
  expect((await context.cookies()).some((entry) => entry.name === "manager_session")).toBe(false);
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await page.goto("/renters");
  await expect(page).toHaveURL("/login");
});
