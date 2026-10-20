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
  await page.goto(`/rooms?motel=${MOTEL.id}&status=active`);
  await page.getByRole("banner").getByRole("combobox", { name: "Nhà trọ", exact: true }).click();
  await page.getByRole("option", { name: MOTEL_WITHOUT_EXTRAS.name, exact: true }).click();
  await expect(page).toHaveURL(`/rooms?motel=${MOTEL_WITHOUT_EXTRAS.id}&status=active`);
  await page.getByRole("navigation", { name: "Điều hướng chính trên điện thoại" }).getByRole("link", { name: "Khách thuê" }).click();
  await expect(page).toHaveURL(`/renters?motel=${MOTEL_WITHOUT_EXTRAS.id}&status=active`);
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
  const account = page.getByLabel("Menu phụ, Tài khoản", { exact: true });
  await account.click();
  await expect(page.getByText(MANAGER_ME.email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL("/login");
  expect((await context.cookies()).some((cookie) => cookie.name === "manager_session")).toBe(false);
  await page.goto("/rooms");
  await expect(page).toHaveURL("/login");
});

test("account menu closes on Escape and restores focus to its button", async ({ page, context }) => {
  await signIn(context);
  await page.goto(`/?motel=${MOTEL.id}`);
  const trigger = page.getByLabel("Menu phụ, Tài khoản", { exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const logout = page.getByRole("button", { name: "Đăng xuất" });
  await logout.focus();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
});

test("mobile navigation contains five reachable destinations and a labelled secondary menu", async ({ page, context }) => {
  await signIn(context);
  await page.goto(`/?motel=${MOTEL.id}`);
  const nav = page.getByRole("navigation", { name: "Điều hướng chính trên điện thoại" });
  await expect(nav.getByRole("link")).toHaveCount(5);
  const more = page.getByRole("button", { name: "Thêm, các mục khác" });
  await expect(more).toBeVisible();
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.focus();
  await page.keyboard.press("Space");
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await page.keyboard.press("Space");
  await expect(more).toHaveAttribute("aria-expanded", "true");
  const secondary = page.getByRole("group", { name: "Các mục khác" }).getByRole("link", { name: "Hợp đồng", exact: true });
  await expect(secondary).toHaveAttribute("href", `/contracts?motel=${MOTEL.id}`);
  await expect(secondary).not.toHaveAttribute("href", `/contracts?motel=${MOTEL.id}&status=active`);
  await expect(secondary).toBeVisible();
  await secondary.focus();
  await secondary.press("Enter");
  await expect(page).toHaveURL(`/contracts?motel=${MOTEL.id}`);
  await expect(page).not.toHaveURL(/status=active/);
  await expect(page.getByRole("main")).toContainText("Hợp đồng");
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await page.goto(`/?motel=${MOTEL.id}`);
  for (const width of [360, 375, 430, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow at ${width}px`).toBe(true);
    if (width < 1024) {
      const mobileNav = page.getByRole("navigation", { name: "Điều hướng chính trên điện thoại" });
      const controls = [...await mobileNav.getByRole("link").all(), await page.getByRole("button", { name: "Thêm, các mục khác" })];
      const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
      expect(boxes.every((box) => box && box.width >= 44 && box.height >= 44), `touch target below 44px at ${width}px`).toBe(true);
    }
    if (width < 1024) {
      const mobileNav = page.getByRole("navigation", { name: "Điều hướng chính trên điện thoại" });
      await expect(mobileNav.getByRole("link")).toHaveCount(5);
      const navBox = await mobileNav.boundingBox();
      expect(navBox).not.toBeNull();
      expect(navBox!.x).toBeGreaterThanOrEqual(0);
      expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(width);
    } else {
      const sidebar = page.getByRole("complementary", { name: "Thanh điều hướng" });
      await expect(sidebar).toBeVisible();
      await expect(sidebar).toHaveCSS("position", "sticky");
      await expect(sidebar).toHaveCSS("width", "240px");
      expect((await page.getByRole("main").boundingBox())!.x).toBeGreaterThanOrEqual(await sidebar.evaluate((node) => node.getBoundingClientRect().right));
    }
  }
  await page.setViewportSize({ width: 375, height: 667 });
  for (const [name, path] of [["Nhà trọ", "/motels"], ["Phòng trọ", "/rooms"], ["Khách thuê", "/renters"], ["Tính tiền & Hóa đơn", "/billing"], ["Tổng quan", "/"]]) {
    const link = nav.getByRole("link", { name, exact: true });
    await link.focus();
    await link.press("Enter");
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${path}?motel=${MOTEL.id}`);
    await page.goto(`/?motel=${MOTEL.id}`);
  }
  await more.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("group", { name: "Các mục khác" }).getByRole("link", { name: "Hợp đồng" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("desktop sidebar is sticky, 240px wide, and main content clears it", async ({ page, context }) => {
  await signIn(context);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/?motel=${MOTEL.id}`);
  const sidebar = page.getByRole("complementary", { name: "Thanh điều hướng" });
  await expect(sidebar).toBeVisible();
  expect(await sidebar.evaluate((element) => ({ width: element.getBoundingClientRect().width, position: getComputedStyle(element).position }))).toEqual({ width: 240, position: "sticky" });
  await expect(sidebar.getByRole("link")).toHaveCount(6);
  const sidebarRight = await sidebar.evaluate((element) => element.getBoundingClientRect().right);
  const main = page.getByRole("main");
  await expect(main).toBeVisible();
  const mainBox = await main.boundingBox();
  expect(mainBox).not.toBeNull();
  expect(mainBox!.x).toBeGreaterThanOrEqual(sidebarRight);
  expect(await main.evaluate((element) => getComputedStyle(element.parentElement!.parentElement!.parentElement!).display)).toBe("flex");
});
