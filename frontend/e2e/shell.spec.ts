import { expect, test, type BrowserContext } from "@playwright/test";
import { MANAGER_ME, MOTEL, MOTEL_WITHOUT_EXTRAS } from "../src/lib/api/__tests__/fixtures";

async function signIn(context: BrowserContext, session = "valid") {
  await context.addCookies([{ name: "manager_session", value: session, url: "http://localhost:3001", httpOnly: true, sameSite: "Lax" }]);
}

test("unauthenticated rooms redirect to login", async ({ page }) => {
  await page.goto("/rooms");
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
});

test("login stores the proxied session and lands on the overview", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(MANAGER_ME.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(`/?motel=${MOTEL.id}`);
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
  expect((await context.cookies()).find((cookie) => cookie.name === "manager_session")?.httpOnly).toBe(true);
});

test("401 login errors are inline Vietnamese text and keep the form", async ({ page }) => {
  await page.route("**/api/auth/login", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Email hoặc mật khẩu không đúng", code: "UNAUTHORIZED" }) }));
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(MANAGER_ME.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("Email hoặc mật khẩu không đúng");
  await expect(page).toHaveURL("/login");
});

test("missing login fields are described inline before a request is made", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/auth/login", () => { requests += 1; });
  await page.goto("/login");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const email = page.getByLabel("Email", { exact: true });
  const password = page.getByLabel("Mật khẩu", { exact: true });
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAccessibleDescription("Nhập email hợp lệ");
  await expect(password).toHaveAccessibleDescription("Nhập mật khẩu");
  expect(requests).toBe(0);
});

test("switching motel preserves the pathname and other search parameters", async ({ page, context }) => {
  await signIn(context);
  await page.goto(`/rooms?motel=${MOTEL.id}&status=available`);
  await page.getByRole("combobox", { name: "Nhà trọ", exact: true }).selectOption(MOTEL_WITHOUT_EXTRAS.id);
  await expect(page).toHaveURL(`/rooms?motel=${MOTEL_WITHOUT_EXTRAS.id}&status=available`);
  await expect(page.getByRole("combobox", { name: "Nhà trọ", exact: true })).toHaveValue(MOTEL_WITHOUT_EXTRAS.id);
  await page.getByRole("navigation", { name: "Điều hướng chính trên điện thoại" }).getByRole("link", { name: "Khách thuê" }).click();
  await expect(page).toHaveURL(`/renters?motel=${MOTEL_WITHOUT_EXTRAS.id}`);
});

test("absent motel is replaced with the first owned motel", async ({ page, context }) => {
  await signIn(context);
  await page.goto("/rooms?status=available");
  await expect(page).toHaveURL(`/rooms?status=available&motel=${MOTEL.id}`);
});

test("foreign motel selections render the Vietnamese not-found state", async ({ page, context }) => {
  await signIn(context);
  await page.goto("/rooms?motel=foreign");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
});

for (const session of ["me-expired", "motels-expired"]) {
  test(`${session} redirects to login when a server read returns 401`, async ({ page, context }) => {
    await signIn(context, session);
    await page.goto("/rooms");
    await expect(page).toHaveURL("/login");
  });
}

test("manager without motels can reach the shell without redirecting in a loop", async ({ page, context }) => {
  await signIn(context, "no-motels");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Nhà trọ", exact: true })).toBeDisabled();
  await expect(page).toHaveURL("/");
});

test("logout clears the session through the proxy and returns to login", async ({ page, context }) => {
  await signIn(context);
  await page.goto(`/?motel=${MOTEL.id}`);
  await page.getByLabel("Menu phụ, Tài khoản", { exact: true }).click();
  await expect(page.getByText(MANAGER_ME.email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL("/login");
  expect((await context.cookies()).some((cookie) => cookie.name === "manager_session")).toBe(false);
  await page.goto("/rooms");
  await expect(page).toHaveURL("/login");
});

test("mobile navigation contains five reachable destinations and a labelled secondary menu", async ({ page, context }) => {
  await signIn(context);
  await page.goto(`/?motel=${MOTEL.id}`);
  const nav = page.getByRole("navigation", { name: "Điều hướng chính trên điện thoại" });
  await expect(nav.getByRole("link")).toHaveCount(5);
  await expect(page.getByText("Menu phụ", { exact: true })).toBeVisible();
  for (const [name, path] of [["Nhà trọ", "/motels"], ["Phòng trọ", "/rooms"], ["Khách thuê", "/renters"], ["Tổng quan", "/"]]) {
    const link = nav.getByRole("link", { name, exact: true });
    await link.focus();
    await link.press("Enter");
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${path}?motel=${MOTEL.id}`);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("desktop sidebar is sticky and 240px wide", async ({ page, context }) => {
  await signIn(context);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/?motel=${MOTEL.id}`);
  const sidebar = page.getByRole("complementary", { name: "Thanh điều hướng" });
  await expect(sidebar).toBeVisible();
  expect(await sidebar.evaluate((element) => ({ width: element.getBoundingClientRect().width, position: getComputedStyle(element).position }))).toEqual({ width: 240, position: "sticky" });
  await expect(sidebar.getByRole("link")).toHaveCount(5);
});
