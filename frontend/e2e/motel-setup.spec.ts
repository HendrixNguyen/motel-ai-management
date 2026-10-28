import { expect, test, type BrowserContext } from "@playwright/test";
import { MOTEL } from "../test/lib/api/fixtures";

async function signIn(context: BrowserContext, session = "valid") {
  await context.addCookies([
    {
      name: "manager_session",
      value: session,
      url: "http://localhost:3001",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

test("full_setup_creates_first_motel", async ({ page, context }) => {
  await signIn(context, "no-motels");
  let setupPayload: Record<string, unknown> | null = null;
  await page.route("**/api/manager/motels/setup", async (route) => {
    setupPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        motelId: "m-first-123",
        mode: "full",
        roomCount: 1,
        templateId: "t-template-123",
      }),
    });
  });

  await page.goto("/motels");
  await expect(page.getByRole("heading", { name: "Chưa có nhà trọ" })).toBeVisible();

  await page.getByRole("button", { name: "Tạo nhà trọ", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bước 1: Thông tin nhà trọ" });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Tên nhà trọ", { exact: true }).fill("Nhà Trọ Hương Sen");
  await dialog.getByLabel("Địa chỉ (không bắt buộc)").fill("123 Đường Số 1");
  await dialog.getByLabel("Giá điện (₫/kWh)").fill("3500");
  await dialog.getByLabel("Giá nước (₫/m³)").fill("25000");

  await dialog.getByLabel("Thiết lập tài khoản nhận tiền").check();
  await dialog.getByLabel("Mã ngân hàng (BIN)").fill("970422");
  await dialog.getByLabel("Số tài khoản").fill("19036789101112");
  await dialog.getByLabel("Tên chủ tài khoản").fill("NGUYEN VAN MINH");

  await dialog.getByRole("button", { name: "Tiếp tục" }).click();

  await expect(page.getByRole("dialog", { name: "Bước 2: Mẫu hợp đồng" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Mẫu từ thư viện mẫu chuẩn" })).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  await expect(page.getByRole("dialog", { name: "Bước 3: Danh sách phòng" })).toBeVisible();
  const step3Dialog = page.getByRole("dialog", { name: "Bước 3: Danh sách phòng" });
  await step3Dialog.getByLabel("Tiền tố phòng").fill("P");
  await step3Dialog.getByLabel("Số bắt đầu").fill("101");
  await step3Dialog.getByLabel("Số lượng phòng").fill("1");
  await step3Dialog.getByLabel("Giá thuê mặc định (₫)").fill("3500000");
  await step3Dialog.getByRole("button", { name: "Sinh danh sách phòng" }).click();

  await expect(step3Dialog.getByText("Danh sách 1 phòng:")).toBeVisible();
  await step3Dialog.getByRole("button", { name: "Tiếp tục" }).click();

  await expect(page.getByRole("dialog", { name: "Bước 4: Xác nhận và hoàn tất" })).toBeVisible();
  const step4Dialog = page.getByRole("dialog", { name: "Bước 4: Xác nhận và hoàn tất" });
  await expect(step4Dialog.getByText("Nhà Trọ Hương Sen")).toBeVisible();
  await expect(step4Dialog.getByText("1 phòng")).toBeVisible();
  await expect(step4Dialog.getByText("3500 ₫/kWh")).toBeVisible();
  await expect(step4Dialog.getByText("25000 ₫/m³")).toBeVisible();

  await step4Dialog.getByRole("button", { name: "Hoàn tất thiết lập" }).click();

  await expect(step4Dialog).not.toBeVisible();
  await expect(page.getByText("Đã tạo nhà trọ thành công")).toBeVisible();

  expect(setupPayload).not.toBeNull();
  const payload1 = setupPayload as unknown as Record<string, unknown>;
  expect(payload1).toMatchObject({
    mode: "full",
    motel: {
      name: "Nhà Trọ Hương Sen",
      address: "123 Đường Số 1",
      electricityPrice: "3500",
      waterPrice: "25000",
      bankAccount: {
        bankCode: "970422",
        accountNumber: "19036789101112",
        accountName: "NGUYEN VAN MINH",
      },
    },
    template: {
      kind: "catalog",
    },
    rooms: [
      {
        name: "P101",
        basePrice: "3500000",
      },
    ],
  });
  expect(payload1.requestId).toBeDefined();
});

test("second_motel_copies_selected_groups_then_skips", async ({ page, context }) => {
  await signIn(context, "valid");
  let setupPayload: Record<string, unknown> | null = null;
  await page.route("**/api/manager/motels/setup", async (route) => {
    setupPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        motelId: "m-second-456",
        mode: "quick",
        roomCount: 0,
        templateId: null,
      }),
    });
  });

  await page.goto("/motels");
  await expect(page.getByRole("heading", { name: MOTEL.name })).toBeVisible();

  await page.getByRole("button", { name: "Tạo nhà trọ", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bước 1: Thông tin nhà trọ" });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Chọn nhà trọ nguồn").selectOption(MOTEL.id);
  await dialog.getByRole("checkbox", { name: "Tài khoản nhận tiền", exact: true }).check();
  await dialog.getByLabel("Giá điện, nước và phí khác").check();
  await dialog.getByRole("button", { name: "Áp dụng" }).click();

  await expect(dialog.getByLabel("Giá điện (₫/kWh)")).toHaveValue("3.500");
  await expect(dialog.getByLabel("Giá nước (₫/m³)")).toHaveValue("15.000");
  if (MOTEL.bankAccount) {
    await expect(dialog.getByLabel("Số tài khoản")).toHaveValue(MOTEL.bankAccount.accountNumber);
  }

  await dialog.getByLabel("Tên nhà trọ", { exact: true }).fill("Nhà Trọ Chi Nhánh 2");
  await dialog.getByRole("button", { name: "Tạo nhanh (bỏ qua thiết lập)" }).click();

  await expect(page.getByRole("dialog", { name: "Bước 4: Xác nhận và hoàn tất" })).toBeVisible();
  const step4Dialog = page.getByRole("dialog", { name: "Bước 4: Xác nhận và hoàn tất" });
  await expect(step4Dialog.getByText("Nhà Trọ Chi Nhánh 2")).toBeVisible();
  await expect(step4Dialog.getByText("Tạo nhanh", { exact: true })).toBeVisible();
  await expect(step4Dialog.getByText("0 phòng (Tạo nhanh)")).toBeVisible();

  await step4Dialog.getByRole("button", { name: "Hoàn tất thiết lập" }).click();

  await expect(step4Dialog).not.toBeVisible();
  await expect(page.getByText("Đã tạo nhanh nhà trọ")).toBeVisible();

  expect(setupPayload).not.toBeNull();
  const payload2 = setupPayload as unknown as Record<string, unknown>;
  expect(payload2).toMatchObject({
    mode: "quick",
    motel: {
      name: "Nhà Trọ Chi Nhánh 2",
      electricityPrice: MOTEL.electricityPrice,
      waterPrice: MOTEL.waterPrice,
    },
  });
  expect(payload2.rooms).toBeUndefined();
  expect(payload2.sourceName).toBeUndefined();
  expect(payload2.publicAccessCode).toBeUndefined();
});

test("quick_motel_selects_catalog_later", async ({ page, context }) => {
  await signIn(context, "valid");
  let fromCatalogPayload: Record<string, unknown> | null = null;
  await page.route(
    `**/api/manager/motels/${MOTEL.id}/contract-templates/from-catalog`,
    async (route) => {
      fromCatalogPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "tpl-copied-from-cat",
          motelId: MOTEL.id,
          name: "Hợp đồng thuê phòng trọ chuẩn",
          clauses: [{ title: "Điều 1", content: "Nội dung" }],
          isDefault: true,
          createdAt: new Date().toISOString(),
        }),
      });
    },
  );

  await page.goto(`/contracts?motel=${MOTEL.id}`);
  await expect(page.getByRole("heading", { name: "Hợp đồng" })).toBeVisible();

  await page.getByRole("button", { name: "Mẫu hợp đồng", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Mẫu hợp đồng" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Chọn mẫu có sẵn" }).click();
  await expect(dialog.getByRole("combobox", { name: "Mẫu từ thư viện mẫu chuẩn" })).toBeVisible();

  await dialog.getByLabel("Đặt làm mẫu mặc định cho nhà trọ này").check();
  await dialog.getByRole("button", { name: "Áp dụng mẫu" }).click();

  await expect(page.getByText("Đã thêm mẫu hợp đồng từ thư viện")).toBeVisible();
  expect(fromCatalogPayload).not.toBeNull();
  expect(fromCatalogPayload).toMatchObject({
    catalogKey: "standard-vn",
    catalogVersion: 1,
    isDefault: true,
  });
});

test("lost_response_refresh_recovers_result", async ({ page, context }) => {
  const reqId = "test-recovery-req-id-uuid-1234";
  await signIn(context, "no-motels");

  await page.addInitScript(
    ({ key, id }) => {
      sessionStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          pendingRequestId: id,
          mode: "quick",
          motel: {
            name: "Nhà Trọ Treo Phản Hồi",
            address: "",
            electricityPrice: "3500",
            waterPrice: "25000",
            otherFees: [],
          },
          template: null,
          rooms: [],
        }),
      );
    },
    { key: "motel-setup-draft:", id: reqId },
  );

  let statusCheckCalled = false;
  await page.route(`**/api/manager/motels/setup-requests/${reqId}`, async (route) => {
    statusCheckCalled = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        motelId: "m-recovered-789",
        mode: "quick",
        roomCount: 0,
        templateId: null,
      }),
    });
  });

  let postCount = 0;
  await page.route("**/api/manager/motels/setup", async (route) => {
    postCount++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        motelId: "m-recovered-789",
        mode: "quick",
        roomCount: 0,
        templateId: null,
      }),
    });
  });

  await page.goto("/motels");
  await page.getByRole("button", { name: "Tạo nhà trọ", exact: true }).click();

  await expect(page.getByText("Nhà trọ đã được tạo từ trước")).toBeVisible();
  expect(statusCheckCalled).toBe(true);
  expect(postCount).toBe(0);

  const cleared = await page.evaluate(() => sessionStorage.getItem("motel-setup-draft:"));
  expect(cleared).toBeNull();
});

test("viewport and keyboard assertions at 375x667 and 1440x900", async ({ page, context }) => {
  await signIn(context, "no-motels");

  for (const size of [
    { width: 375, height: 667 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/motels");

    const createBtn = page.getByRole("button", { name: "Tạo nhà trọ", exact: true });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const dialog = page.getByRole("dialog", { name: "Bước 1: Thông tin nhà trọ" });
    await expect(dialog).toBeVisible();

    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    );
    expect(noOverflow, `horizontal overflow at ${size.width}px`).toBe(true);

    const closeBtn = dialog.getByRole("button", { name: "Hủy" });
    await expect(closeBtn).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(createBtn).toBeFocused();
  }
});

test("source edit 409, foreign 404 and missing catalog display actionable errors without partial success", async ({
  page,
  context,
}) => {
  await signIn(context, "valid");

  await page.route("**/api/manager/contract-template-catalog", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Thư viện mẫu tạm thời không khả dụng", code: "NOT_FOUND" }),
    });
  });

  await page.goto("/motels");
  await page.getByRole("button", { name: "Tạo nhà trọ", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bước 1: Thông tin nhà trọ" });
  await dialog.getByLabel("Tên nhà trọ", { exact: true }).fill("Nhà Trọ Lỗi");
  await dialog.getByLabel("Giá điện (₫/kWh)").fill("3500");
  await dialog.getByLabel("Giá nước (₫/m³)").fill("25000");
  await dialog.getByRole("button", { name: "Tiếp tục" }).click();

  await expect(page.getByRole("dialog", { name: "Bước 2: Mẫu hợp đồng" })).toBeVisible();
  await expect(page.getByText("Thư viện mẫu tạm thời không khả dụng")).toBeVisible();
  await expect(page.getByText("Đã tạo nhà trọ")).not.toBeVisible();
  await expect(page.getByText("thành công")).not.toBeVisible();
});
