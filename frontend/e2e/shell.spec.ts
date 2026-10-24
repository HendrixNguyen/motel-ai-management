import { expect, test, type BrowserContext } from "@playwright/test";
import { BILLING_PERIOD_ID, MANAGER_ME, MOTEL, MOTEL_WITHOUT_EXTRAS, ROOM_ID } from "../test/lib/api/fixtures";

async function signIn(context: BrowserContext, session = "valid") {
  await context.addCookies([
    {
      name: "manager_session",
      value: session,
      url: `http://localhost:${process.env.E2E_PORT ?? 3001}`,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

test("unauthenticated rooms redirect to login", async ({ page }) => {
  await page.goto("/rooms");
  await expect(page).toHaveURL("/login");
  const loginCard = page.locator("main > div");
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  await expect(loginCard).toHaveCSS("width", "343px");
  expect(
    await loginCard
      .getByRole("heading", { name: "Đăng nhập" })
      .evaluate((heading) => heading.getBoundingClientRect().width),
  ).toBeGreaterThan(0);
});

test("login stores the proxied session and lands on the overview", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(MANAGER_ME.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(`/?motel=${MOTEL.id}`);
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.getByRole("main").evaluate((element) => getComputedStyle(element).animationName),
    )
    .not.toBe("none");
  expect(
    (await context.cookies()).find((cookie) => cookie.name === "manager_session")?.httpOnly,
  ).toBe(true);
});

test("401 login errors are inline Vietnamese text and keep the form", async ({ page }) => {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Email hoặc mật khẩu không đúng", code: "UNAUTHORIZED" }),
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(MANAGER_ME.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText(
    "Email hoặc mật khẩu không đúng",
  );
  await expect(page).toHaveURL("/login");
});

test("missing login fields are described inline before a request is made", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/auth/login", () => {
    requests += 1;
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const email = page.getByLabel("Email", { exact: true });
  const password = page.getByLabel("Mật khẩu", { exact: true });
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAccessibleDescription("Nhập email hợp lệ");
  await expect(password).toHaveAccessibleDescription("Nhập mật khẩu");
  expect(requests).toBe(0);
});

test("switching motel preserves the pathname and other search parameters", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto(`/rooms?motel=${MOTEL.id}&status=active`);
  await page.getByRole("banner").getByRole("combobox", { name: "Nhà trọ", exact: true }).click();
  await page.getByRole("option", { name: MOTEL_WITHOUT_EXTRAS.name, exact: true }).click();
  await expect(page).toHaveURL(`/rooms?motel=${MOTEL_WITHOUT_EXTRAS.id}&status=active`);
  await page
    .getByRole("navigation", { name: "Điều hướng chính trên điện thoại" })
    .getByRole("link", { name: "Khách thuê" })
    .click();
  await expect(page).toHaveURL(`/renters?motel=${MOTEL_WITHOUT_EXTRAS.id}&status=active`);
});

test("absent motel is replaced with the first owned motel", async ({ page, context }) => {
  await signIn(context);
  await page.goto("/rooms?status=available");
  await expect(page).toHaveURL(`/rooms?status=available&motel=${MOTEL.id}`);
});

test("foreign motel selections render the Vietnamese not-found state", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto("/rooms?motel=foreign");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
});

for (const session of ["me-expired", "motels-expired"]) {
  test(`${session} redirects to login when a server read returns 401`, async ({
    page,
    context,
  }) => {
    await signIn(context, session);
    await page.goto("/rooms");
    await expect(page).toHaveURL("/login");
  });
}

test("manager without motels can reach the shell without redirecting in a loop", async ({
  page,
  context,
}) => {
  await signIn(context, "no-motels");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
  await expect(
    page.getByRole("banner").getByRole("combobox", { name: "Nhà trọ", exact: true }),
  ).toBeDisabled();
  await expect(page).toHaveURL("/");
});

test("logout clears the session through the proxy and returns to login", async ({
  page,
  context,
}) => {
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

test("account menu closes on Escape and restores focus to its button", async ({
  page,
  context,
}) => {
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

test("mobile navigation contains six reachable destinations", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto(`/?motel=${MOTEL.id}`);
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Điều hướng chính trên điện thoại" });
  await expect(nav.getByRole("link")).toHaveCount(6);
  const contracts = nav.getByRole("link", { name: "Hợp đồng", exact: true });
  await expect(contracts).toHaveAttribute("href", `/contracts?motel=${MOTEL.id}`);
  await expect(contracts).not.toHaveAttribute("href", `/contracts?motel=${MOTEL.id}&status=active`);
  await contracts.focus();
  await contracts.press("Enter");
  await expect(page).toHaveURL(`/contracts?motel=${MOTEL.id}`);
  await expect(page).not.toHaveURL(/status=active/);
  await expect(page.getByRole("main")).toContainText("Hợp đồng");
  await page.goto(`/?motel=${MOTEL.id}`);
  for (const width of [360, 375, 430, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `overflow at ${width}px`,
    ).toBe(true);
    if (width < 1024) {
      const mobileNav = page.getByRole("navigation", { name: "Điều hướng chính trên điện thoại" });
      const controls = await mobileNav.getByRole("link").all();
      const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
      expect(
        boxes.every((box) => box && box.width >= 44 && box.height >= 44),
        `touch target below 44px at ${width}px`,
      ).toBe(true);
    }
    if (width < 1024) {
      const mobileNav = page.getByRole("navigation", { name: "Điều hướng chính trên điện thoại" });
      await expect(mobileNav.getByRole("link")).toHaveCount(6);
      await expect(page.getByRole("button", { name: "Thêm, các mục khác" })).toHaveCount(0);
      const navBox = await mobileNav.boundingBox();
      expect(navBox).not.toBeNull();
      expect(navBox!.x).toBeGreaterThanOrEqual(0);
      expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(width);
    } else {
      const sidebar = page.getByRole("complementary", { name: "Thanh điều hướng" });
      await expect(sidebar).toBeVisible();
      await expect(sidebar).toHaveCSS("position", "sticky");
      await expect(sidebar).toHaveCSS("width", "240px");
      expect((await page.getByRole("main").boundingBox())!.x).toBeGreaterThanOrEqual(
        await sidebar.evaluate((node) => node.getBoundingClientRect().right),
      );
    }
  }
  await page.setViewportSize({ width: 375, height: 667 });
  for (const [name, path] of [
    ["Tổng quan", "/"],
    ["Nhà trọ", "/motels"],
    ["Phòng trọ", "/rooms"],
    ["Khách thuê", "/renters"],
    ["Tính tiền & Hóa đơn", "/billing"],
    ["Hợp đồng", "/contracts"],
  ]) {
    const link = nav.getByRole("link", { name, exact: true });
    await link.focus();
    await link.press("Enter");
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${path}?motel=${MOTEL.id}`);
    await page.goto(`/?motel=${MOTEL.id}`);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("capture queue message opens on demand in shared modal and closes with Escape", async ({
  page,
  context,
}) => {
  await signIn(context, "capture-warning");
  await page.goto("/login");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("motel-capture", 2);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("readings")) db.createObjectStore("readings", { keyPath: "id" });
          if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos", { keyPath: "id" });
        };
        request.onsuccess = () => {
          const tx = request.result.transaction("readings", "readwrite");
          tx.objectStore("readings").put({
            id: "legacy-test",
            managerId: "browser",
            motelId: "any-motel",
            periodId: "any-period",
            status: "pending",
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
  await page.goto(`/capture/${BILLING_PERIOD_ID}/room/${ROOM_ID}?motel=${MOTEL.id}`);
  const notification = page.getByRole("button", { name: /Thông báo dữ liệu ngoại tuyến/ });
  await expect(notification).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await notification.click();
  await expect(page.getByRole("status", { name: "Thông báo dữ liệu ngoại tuyến" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Quản lý dữ liệu" }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("heading", { name: "Xóa dữ liệu nhập chỉ số" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Thông báo dữ liệu ngoại tuyến" })).toBeVisible();
  await notification.click();
  await expect(page.getByRole("status", { name: "Thông báo dữ liệu ngoại tuyến" })).toHaveCount(0);
});

test("desktop sidebar is sticky, 240px wide, and main content clears it", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/?motel=${MOTEL.id}`);
  const sidebar = page.getByRole("complementary", { name: "Thanh điều hướng" });
  await expect(sidebar).toBeVisible();
  expect(
    await sidebar.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      position: getComputedStyle(element).position,
    })),
  ).toEqual({ width: 240, position: "sticky" });
  await expect(sidebar.getByRole("link")).toHaveCount(6);
  await expect(sidebar.getByRole("img", { name: "Nhà Số Gọn" })).toHaveAttribute("src", /logo-mark\.svg/);
  await expect(sidebar.getByText("Nhà Số Gọn", { exact: true })).toBeVisible();
  const sidebarRight = await sidebar.evaluate((element) => element.getBoundingClientRect().right);
  const topbar = page.getByRole("banner");
  const switcher = topbar.getByRole("combobox", { name: "Nhà trọ", exact: true });
  await expect(switcher).toHaveCSS("flex-direction", "row");
  expect(await switcher.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(64);
  expect(await switcher.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(180);
  const title = topbar.getByText("Theo dõi nhà trọ, hóa đơn và khách thuê");
  await expect(title).toBeVisible();
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(switcher).toHaveCSS("flex-direction", "row");
    expect(await switcher.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(64);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  const main = page.getByRole("main");
  await expect(main).toBeVisible();
  const mainBox = await main.boundingBox();
  expect(mainBox).not.toBeNull();
  expect(mainBox!.x).toBeGreaterThanOrEqual(sidebarRight);
  expect(
    await main.evaluate(
      (element) => getComputedStyle(element.parentElement!.parentElement!.parentElement!).display,
    ),
  ).toBe("flex");
});
