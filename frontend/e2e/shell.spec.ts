import { expect, test, type BrowserContext } from "@playwright/test";
import { MANAGER_ME, MOTEL, MOTEL_WITHOUT_EXTRAS } from "../src/lib/api/__tests__/fixtures";

async function signIn(context: BrowserContext, session = "valid") {
  await context.addCookies([{ name: "manager_session", value: session, url: "http://localhost:3001", httpOnly: true, sameSite: "Lax" }]);
}

test("unauthenticated rooms redirect to login", async ({ page }) => {
  await page.goto("/rooms");
  await expect(page).toHaveURL("/login");
  const loginCard = page.locator("main > div");
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  await expect(loginCard).toHaveCSS("width", "343px");
  expect(await loginCard.getByRole("heading", { name: "Đăng nhập" }).evaluate((heading) => heading.getBoundingClientRect().width)).toBeGreaterThan(0);
});

test("login stores the proxied session and lands on the overview", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(MANAGER_ME.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(`/?motel=${MOTEL.id}`);
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
  await expect.poll(() => page.getByRole("main").evaluate((element) => getComputedStyle(element).animationName)).not.toBe("none");
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
  await page.getByRole("banner").getByRole("combobox", { name: "Nhà trọ", exact: true }).click();
  await page.getByRole("option", { name: MOTEL_WITHOUT_EXTRAS.name, exact: true }).click();
  await expect(page).toHaveURL(`/rooms?motel=${MOTEL_WITHOUT_EXTRAS.id}&status=available`);
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
  await expect(page.getByRole("banner").getByRole("combobox", { name: "Nhà trọ", exact: true })).toBeDisabled();
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

test("theme dropdown closes on selection and outside click", async ({ page, context }) => {
  await signIn(context);
  await page.goto(`/?motel=${MOTEL.id}`);
  await page.getByLabel("Menu phụ, Tài khoản", { exact: true }).click();
  const theme = page.getByRole("combobox", { name: "Giao diện", exact: true });
  await theme.click();
  await page.getByRole("option", { name: "Tối", exact: true }).click();
  await expect(theme).toHaveAttribute("aria-expanded", "false");
  await theme.click();
  await page.locator("main").click();
  await expect(theme).toHaveAttribute("aria-expanded", "false");
});

test("account disclosure closes on outside click and Escape but remains open for inside clicks", async ({ page, context }) => {
  await signIn(context);
  await page.goto(`/?motel=${MOTEL.id}`);
  const account = page.getByLabel("Menu phụ, Tài khoản", { exact: true });
  await account.click();
  await expect(page.getByText(MANAGER_ME.email, { exact: true })).toBeVisible();
  await page.getByText(MANAGER_ME.email, { exact: true }).click();
  await expect(page.getByText(MANAGER_ME.email, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(MANAGER_ME.email, { exact: true })).toBeHidden();
  await account.click();
  await page.locator("main").click();
  await expect(page.getByText(MANAGER_ME.email, { exact: true })).toBeHidden();
});

test("mobile navigation contains five reachable destinations and a labelled secondary menu", async ({ page, context }) => {
  await signIn(context);
  await page.goto(`/?motel=${MOTEL.id}`);
  const nav = page.getByRole("navigation", { name: "Điều hướng chính trên điện thoại" });
  await expect(nav.getByRole("link")).toHaveCount(5);
  await expect(page.getByText("Menu phụ", { exact: true })).toBeVisible();
  await expect.poll(() => nav.getByRole("link", { name: "Tổng quan", exact: true }).evaluate((element) => getComputedStyle(element).transitionDuration)).not.toBe("0s");
  for (const [name, path] of [["Nhà trọ", "/motels"], ["Phòng trọ", "/rooms"], ["Khách thuê", "/renters"], ["Tổng quan", "/"]]) {
    const link = nav.getByRole("link", { name, exact: true });
    await link.focus();
    await link.press("Enter");
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${path}?motel=${MOTEL.id}`);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("manager shell has aligned, usable geometry at phone and desktop widths", async ({ page, context }) => {
  await signIn(context);
  for (const width of [375, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/?motel=${MOTEL.id}`);
    const header = page.getByRole("banner");
    const main = page.getByRole("main");
    const selector = header.getByRole("combobox", { name: "Nhà trọ", exact: true });
    const selectorBox = await selector.boundingBox();
    expect(selectorBox?.width).toBeGreaterThanOrEqual(width >= 1024 ? 180 : 44);
    expect(selectorBox?.height).toBeLessThanOrEqual(width >= 1024 ? 64 : 112);
    const headerBox = await header.boundingBox();
    const mainBox = await main.boundingBox();
    expect(headerBox?.height).toBeLessThanOrEqual(width >= 1024 ? 120 : 112);
    if (width >= 1024) {
      expect(Math.abs(headerBox!.x - mainBox!.x)).toBeLessThanOrEqual(2);
      expect(await main.evaluate((element) => getComputedStyle(element).maxWidth)).toBe("none");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("desktop sidebar is sticky, 240px wide, and main content clears it", async ({ page, context }) => {
  await signIn(context);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/?motel=${MOTEL.id}`);
  const sidebar = page.getByRole("complementary", { name: "Thanh điều hướng" });
  await expect(sidebar).toBeVisible();
  expect(await sidebar.evaluate((element) => ({ width: element.getBoundingClientRect().width, position: getComputedStyle(element).position }))).toEqual({ width: 240, position: "sticky" });
  await expect(sidebar.getByRole("link")).toHaveCount(5);
  const sidebarRight = await sidebar.evaluate((element) => element.getBoundingClientRect().right);
  const main = page.getByRole("main");
  await expect(main).toBeVisible();
  const mainBox = await main.boundingBox();
  expect(mainBox).not.toBeNull();
  expect(mainBox!.x).toBeGreaterThanOrEqual(sidebarRight);
  expect(await main.evaluate((element) => getComputedStyle(element.parentElement!.parentElement!.parentElement!).display)).toBe("flex");

  // App name is visible
  await expect(sidebar.getByText("Nhà Số Gọn")).toBeVisible();

  // Test sidebar collapse toggle
  const collapseButton = sidebar.getByRole("button", { name: "Thu gọn thanh điều hướng" });
  await collapseButton.click();
  await expect(sidebar.getByRole("button", { name: "Mở rộng thanh điều hướng" })).toBeVisible();
  expect(await sidebar.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(80);
  await expect(sidebar.getByText("Nhà Số Gọn")).toBeHidden();

  // Expand back
  await sidebar.getByRole("button", { name: "Mở rộng thanh điều hướng" }).click();
  expect(await sidebar.evaluate((element) => element.getBoundingClientRect().width)).toEqual(240);
  await expect(sidebar.getByText("Nhà Số Gọn")).toBeVisible();
});
