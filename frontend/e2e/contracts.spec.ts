import { expect, test } from "@playwright/test";
import { MOTEL, RENTER, ROOM } from "../test/lib/api/fixtures";

async function manager(page: import("@playwright/test").Page) {
  await page.context().addCookies([
    {
      name: "manager_session",
      value: "contract-ui",
      url: "http://localhost:3001",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

test("desktop Contracts destination appears once in primary navigation", async ({ page }) => {
  await manager(page);
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto(`/?motel=${MOTEL.id}`);
  await expect(
    page
      .getByRole("complementary", { name: "Thanh điều hướng" })
      .getByRole("link", { name: "Hợp đồng", exact: true }),
  ).toHaveCount(1);
  await page.getByLabel("Menu phụ, Tài khoản", { exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Tùy chọn tài khoản" }).getByRole("link", { name: "Hợp đồng" }),
  ).toHaveCount(0);
});

test("contract cards reflow without horizontal overflow across manager widths", async ({
  page,
}) => {
  await manager(page);
  await page.goto(`/contracts?motel=${MOTEL.id}`);
  for (const width of [360, 375, 430, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 820 });
    await expect(page.getByRole("heading", { name: "Hợp đồng" })).toBeVisible();
    const main = await page.getByRole("main").boundingBox();
    expect(main).not.toBeNull();
    expect(main!.x).toBeGreaterThanOrEqual(0);
    expect(main!.x + main!.width).toBeLessThanOrEqual(width);
    const createButton = page.getByRole("button", { name: "Tạo hợp đồng", exact: true });
    const createBounds = await createButton.boundingBox();
    expect(createBounds).not.toBeNull();
    expect(createBounds!.x).toBeGreaterThanOrEqual(main!.x);
    expect(createBounds!.x + createBounds!.width).toBeLessThanOrEqual(main!.x + main!.width);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `horizontal overflow at ${width}px`,
    ).toBe(true);
  }
});

test("manager can create a motel-scoped draft contract from active renter and room", async ({
  page,
}) => {
  await manager(page);
  await page.goto(`/contracts?motel=${MOTEL.id}`);
  await expect(page.getByRole("heading", { name: "Hợp đồng" })).toBeVisible();
  await page.getByRole("button", { name: "Tạo hợp đồng", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo hợp đồng nháp" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox", { name: "Khách thuê" }).click();
  await page.getByRole("option", { name: `${RENTER.name} · 84901234567` }).click();
  await dialog.getByRole("combobox", { name: "Phòng" }).click();
  await page.getByRole("option", { name: ROOM.name }).click();
  await dialog.getByLabel("Ngày bắt đầu").fill("2026-11-01");
  await dialog.getByLabel("Ngày kết thúc").fill("2027-10-31");
  await dialog.getByLabel("Tiền thuê/tháng").fill("3.500.000");
  await dialog.getByLabel("Tiền cọc").fill("1.000.000");
  await dialog.getByRole("button", { name: "Tạo hợp đồng nháp", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Bản nháp", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sửa bản nháp", exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Đã tạo hợp đồng nháp" })).toBeVisible();
});

test("active contract detail shows clause snapshot and confirms termination", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "manager_session",
      value: "contract-active",
      url: "http://localhost:3001",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(`/contracts?motel=${MOTEL.id}`);
  await expect(page.getByText("Trần Thị B", { exact: true })).toBeVisible();
  await expect(page.getByText("Đang hiệu lực", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chi tiết hợp đồng", exact: true }).click();
  const detail = page.getByRole("dialog", { name: /Hợp đồng · Trần Thị B/ });
  await expect(detail.getByText("Đúng hạn", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Đóng", exact: true }).click();
  page.once("dialog", (nativeDialog) => nativeDialog.accept());
  await page.getByRole("button", { name: "Chấm dứt", exact: true }).click();
});

test("manager can edit an existing draft without changing renter or room", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "manager_session",
      value: "contract-draft",
      url: "http://localhost:3001",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(`/contracts?motel=${MOTEL.id}`);
  await page.getByRole("button", { name: "Sửa bản nháp", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa hợp đồng nháp" });
  await dialog.getByLabel("Tiền thuê/tháng").fill("4.000.000");
  await dialog.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("4.000.000 ₫", { exact: true })).toBeVisible();
});

test("manager can request to send a draft contract and see pending state", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "manager_session",
      value: "contract-draft",
      url: "http://localhost:3001",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(`/contracts?motel=${MOTEL.id}`);
  await expect(page.getByText("Chưa gửi liên kết", { exact: true })).toBeVisible();
  const sendResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "POST" &&
      /\/api\/manager\/motels\/.+\/contracts\/contract-draft\/send$/.test(url.pathname)
    );
  });
  await page.getByRole("button", { name: "Yêu cầu gửi", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã ghi nhận yêu cầu gửi hợp đồng" }),
  ).toBeVisible();
  await expect(page.getByText("Đã gửi liên kết · chờ xác nhận", { exact: true })).toBeVisible();
  await expect(await sendResponse.then((r) => r.status())).toBe(200);
});

test("manager can create a scoped template from the template dialog", async ({ page }) => {
  await manager(page);
  await page.goto(`/contracts?motel=${MOTEL.id}`);
  await page.getByRole("button", { name: "Mẫu hợp đồng", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Mẫu hợp đồng" });
  await dialog.getByLabel("Tên mẫu", { exact: true }).fill("Hợp đồng mới");
  await dialog.getByLabel("Tiêu đề điều khoản", { exact: true }).fill("Tiền cọc");
  await dialog
    .getByLabel("Nội dung điều khoản", { exact: true })
    .fill("Hoàn lại khi bàn giao phòng");
  await dialog.getByRole("button", { name: "Lưu mẫu", exact: true }).click();
  await expect(dialog.getByText("Hợp đồng mới", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Sửa mẫu Hợp đồng mới", exact: true }).click();
  await dialog.getByLabel("Tên mẫu").fill("Mẫu chỉnh sửa");
  await dialog.getByRole("button", { name: "Cập nhật mẫu", exact: true }).click();
  await expect(dialog.getByText("Mẫu chỉnh sửa", { exact: true })).toBeVisible();
  page.once("dialog", (nativeDialog) => nativeDialog.accept());
  await dialog.getByRole("button", { name: "Xóa mẫu Mẫu chỉnh sửa", exact: true }).click();
  await expect(dialog.getByText("Mẫu chỉnh sửa", { exact: true })).toHaveCount(0);
});
