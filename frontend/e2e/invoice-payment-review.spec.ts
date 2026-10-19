import { expect, test } from "@playwright/test";
import { MOTEL, MANAGER_ID, MOTEL_ID, RENTER_ID, BILLING_PERIOD_ID } from "../src/lib/api/__tests__/fixtures";
import type { MotelResponse, RenterResponse } from "../src/lib/api/types";

test("manager reviews proof, rejects with reason, approves proof, and confirms cash distinctly", async ({ page, context }) => {
  await context.addCookies([{ name: "manager_session", value: "payment-review-session", domain: "localhost", path: "/" }]);
  const motel: MotelResponse = MOTEL;
  const renter: RenterResponse = { id: RENTER_ID, name: "Trần Thị B", phone: "84901234567", motelId: MOTEL_ID, idNumber: null, idCardFrontUploaded: false, idCardBackUploaded: false, roomId: null, zaloOaId: null, isOaFollower: false, status: "active", createdAt: MOTEL.createdAt };
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { id: MANAGER_ID, email: "manager@example.vn" } }));
  await page.route("**/api/manager/motels", (route) => route.fulfill({ json: [motel] }));
  await page.route(`**/api/manager/motels/${MOTEL_ID}/billing/periods`, (route) => route.fulfill({ json: [{ id: BILLING_PERIOD_ID, motelId: MOTEL_ID, month: 10, year: 2026, status: "sent", createdAt: "2026-10-01T00:00:00.000Z" }] }));
  await page.route(`**/api/manager/motels/${MOTEL_ID}/renters`, (route) => route.fulfill({ json: [renter] }));

  await page.goto(`/billing/${BILLING_PERIOD_ID}/invoices?motel=${MOTEL_ID}`);
  await expect(page.getByRole("heading", { name: /Hóa đơn tháng/ })).toBeVisible();
  const proofCard = page.getByRole("region", { name: "Chứng từ thanh toán" }).first();
  await expect(proofCard.getByRole("img", { name: "Chứng từ thanh toán" })).toBeVisible();
  const reject = proofCard.getByRole("button", { name: "Từ chối chứng từ" });
  await expect(reject).toBeDisabled();
  await proofCard.getByLabel("Lý do từ chối").fill("Ảnh chưa rõ");
  await reject.click();
  await expect(page.getByText("Chứng từ đã bị từ chối. Hóa đơn vẫn chưa thanh toán.")).toBeVisible();
  await expect(proofCard.getByText("Lý do từ chối: Ảnh chưa rõ")).toBeVisible();
  await expect(proofCard.getByRole("button", { name: "Từ chối chứng từ" })).toHaveCount(0);

  const approveCard = page.locator("article").filter({ hasText: "P.102" });
  await approveCard.getByRole("button", { name: "Duyệt chứng từ" }).click();
  await expect(approveCard.getByText("Đã ghi nhận thanh toán qua chuyển khoản. Trạng thái: paid.")).toBeVisible();
  await expect(approveCard.getByText("Đã thanh toán qua chuyển khoản", { exact: true })).toBeVisible();
  await expect(approveCard.getByRole("button", { name: "Duyệt chứng từ" })).toHaveCount(0);

  const cashCard = page.locator("article").filter({ hasText: "P.103" });
  page.once("dialog", (dialog) => dialog.accept());
  await cashCard.getByRole("button", { name: "Xác nhận đã nhận tiền mặt" }).click();
  await expect(cashCard.getByText("Đã xác nhận thanh toán bằng tiền mặt. Trạng thái: paid.")).toBeVisible();
  await expect(cashCard.getByText("Đã thanh toán bằng tiền mặt", { exact: true })).toBeVisible();
  await expect(cashCard.getByRole("button", { name: "Xác nhận đã nhận tiền mặt" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
