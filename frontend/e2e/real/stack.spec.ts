import { expect, test } from "@playwright/test";
import { redactLiveQaDiagnostic, validateLiveQaConfig } from "../../src/lib/real-qa-safety";

const configErrors = validateLiveQaConfig(process.env);
const authenticatedErrors = validateLiveQaConfig(process.env, "authenticated");
const mutationErrors = validateLiveQaConfig(process.env, "mutating");

test.beforeAll(async ({ request }) => {
  expect(configErrors, `Live QA preflight rejected configuration: ${configErrors.join("; ")}`).toEqual([]);
  const response = await request.get(`${process.env.E2E_FRONTEND_URL}/api/auth/me`);
  expect(response.status(), "A reachable QA frontend proxy must reject an anonymous identity read").toBe(401);
});

test("live manager login forwards httpOnly cookie, opens shell and logs out", async ({ page, context }) => {
  expect(authenticatedErrors, `Live QA authenticated preflight rejected configuration: ${authenticatedErrors.join("; ")}`).toEqual([]);
  await page.goto("/login");
  await signIn(page);
  const cookie = (await context.cookies()).find((entry) => entry.name === "manager_session");
  expect(cookie?.httpOnly).toBe(true);
  const identity = await page.request.get("/api/auth/me");
  expect(identity.status()).toBe(200);
  const identityBody = await identity.json() as { id?: string };
  if (process.env.E2E_QA_MANAGER_ID) expect(identityBody.id).toBe(process.env.E2E_QA_MANAGER_ID);
  await page.getByLabel("Menu phụ, Tài khoản", { exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL("/login");
  expect((await context.cookies()).some((entry) => entry.name === "manager_session")).toBe(false);
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await page.goto("/renters");
  await expect(page).toHaveURL("/login");
});

test.describe("QA UI mutations", () => {
  test.beforeEach(async ({ page }) => {
    expect(mutationErrors, `Live QA mutation preflight rejected configuration: ${mutationErrors.join("; ")}`).toEqual([]);
    await page.goto("/login");
    await signIn(page);
    const response = await page.request.get("/api/auth/me");
    const identity = await response.json() as { id?: string };
    expect(identity.id, "Login must match dedicated E2E_QA_MANAGER_ID").toBe(process.env.E2E_QA_MANAGER_ID);
  });

  test("creates run-scoped motel, room and renter, then persists after reload", async ({ page }) => {
    const runId = `${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
    const motelName = `QA Motel ${runId}`;
    const roomName = `QA-${runId}`;
    const renterName = `QA Renter ${runId}`;
    const phone = `849${Math.floor(10000000 + Math.random() * 89999999)}`;
    const diagnostics: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") diagnostics.push(redactLiveQaDiagnostic(message.text())); });
    page.on("pageerror", (error) => diagnostics.push(redactLiveQaDiagnostic(error.message)));
    page.on("response", (response) => {
      if (response.url().includes("/api/") && response.status() >= 400) diagnostics.push(redactLiveQaDiagnostic(`${response.request().method()} ${new URL(response.url()).pathname} ${response.status()}`));
    });

    await page.goto("/motels");
    await page.getByRole("button", { name: "Tạo nhà trọ", exact: true }).click();
    const motelDialog = page.getByRole("dialog");
    await motelDialog.getByLabel("Tên nhà trọ", { exact: true }).fill(motelName);
    await motelDialog.getByLabel("Giá điện (₫/kWh)", { exact: true }).fill("3500");
    await motelDialog.getByLabel("Giá nước (₫/m³)", { exact: true }).fill("15000");
    await motelDialog.getByRole("button", { name: "Tạo nhà trọ", exact: true }).click();
    await expect(page.getByRole("heading", { name: motelName, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: motelName, exact: true })).toBeVisible();
    const motelId = await page.getByRole("banner").getByRole("combobox", { name: "Nhà trọ", exact: true }).locator("option").evaluateAll((options, name) => options.find((option) => option.textContent?.includes(name))?.getAttribute("value"), motelName);
    expect(motelId).toBeTruthy();

    await page.goto(`/rooms?motel=${encodeURIComponent(motelId!)}`);
    await expect(page.getByRole("banner").getByRole("combobox", { name: "Nhà trọ", exact: true })).toHaveValue(motelId!);
    await page.getByRole("button", { name: "Thêm phòng", exact: true }).click();
    const roomDialog = page.getByRole("dialog");
    await roomDialog.getByLabel("Tên phòng", { exact: true }).fill(roomName);
    await roomDialog.getByLabel("Giá thuê cơ bản (₫/tháng)", { exact: true }).fill("3500000");
    await roomDialog.getByLabel("Tầng (không bắt buộc)", { exact: true }).fill("1");
    await roomDialog.getByRole("button", { name: "Thêm phòng", exact: true }).click();
    await expect(page.getByRole("heading", { name: roomName, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: roomName, exact: true })).toBeVisible();

    await page.goto(`/renters?motel=${encodeURIComponent(motelId!)}`);
    await page.getByRole("button", { name: "Thêm khách thuê", exact: true }).click();
    const renterDialog = page.getByRole("dialog");
    await renterDialog.getByLabel("Họ tên", { exact: true }).fill(renterName);
    await renterDialog.getByLabel("Số điện thoại", { exact: true }).fill(phone);
    await renterDialog.getByRole("combobox", { name: "Phòng (không bắt buộc)", exact: true }).selectOption({ label: roomName });
    await renterDialog.getByRole("button", { name: "Thêm khách thuê", exact: true }).click();
    await expect(page.getByText(renterName, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(renterName, { exact: true })).toBeVisible();
    expect(diagnostics).toEqual([]);
  });
});

async function signIn(page: import("@playwright/test").Page) {
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_LOGIN_EMAIL!);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(process.env.E2E_LOGIN_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
}
