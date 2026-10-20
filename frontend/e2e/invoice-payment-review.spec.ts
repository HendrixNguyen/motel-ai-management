import { expect, test } from "@playwright/test";
import { MOTEL, MANAGER_ID, MOTEL_ID, RENTER_ID, BILLING_PERIOD_ID } from "../src/lib/api/__tests__/fixtures";
import type { InvoiceResponse, ManagerPaymentProof, MotelResponse, PaymentProof, RenterResponse } from "../src/lib/api/types";

test("invoice read failures show safe retry UI", async ({ page, context }) => {
  await context.addCookies([{ name: "manager_session", value: "invoice-error", domain: "localhost", path: "/" }]);
  await page.goto(`/billing/${BILLING_PERIOD_ID}/invoices?motel=${MOTEL_ID}`);
  await expect(page.getByRole("heading", { name: "Không thể tải nội dung" })).toBeVisible();
  await expect(page.getByText("Kiểm tra kết nối và thử lại.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("private database.internal");
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: "Không thể tải nội dung" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Không thể tải nội dung" })).toBeVisible();
});

test("manager reviews proof, rejects with reason, approves proof, and confirms cash distinctly", async ({ page, context }) => {
  await context.addCookies([{ name: "manager_session", value: "payment-review-session", domain: "localhost", path: "/" }]);
  const motel: MotelResponse = MOTEL;
  const renter: RenterResponse = { id: RENTER_ID, name: "Trần Thị B", phone: "84901234567", motelId: MOTEL_ID, idNumber: null, idCardFrontUploaded: false, idCardBackUploaded: false, roomId: null, zaloOaId: null, isOaFollower: false, status: "active", createdAt: MOTEL.createdAt };
  const invoice = (id: string, roomId: string, roomName: string, totalAmount: string, qrCodeData: string | null = null): InvoiceResponse => ({ id, billingPeriodId: BILLING_PERIOD_ID, roomId, roomName, renterId: RENTER_ID, motelId: MOTEL_ID, rentAmount: "3500000", electricityUsage: "20.00", electricityCost: "70000", waterUsage: "3.00", waterCost: "45000", otherFees: [], totalAmount, qrCodeData, paymentStatus: "unpaid", paymentMethod: null, paidAt: null, createdAt: "2026-10-01T00:00:00.000Z" });
  const invoices: InvoiceResponse[] = [invoice("invoice-1", "room-1", "P.101", "3615000", "000201010212"), invoice("invoice-approve", "room-2", "P.102", "3615000"), invoice("invoice-cash", "room-3", "P.103", "3615000")];
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { id: MANAGER_ID, email: "manager@example.vn" } }));
  await page.route("**/api/manager/motels", (route) => route.fulfill({ json: [motel] }));
  await page.route(`**/api/manager/motels/${MOTEL_ID}/billing/periods`, (route) => route.fulfill({ json: [{ id: BILLING_PERIOD_ID, motelId: MOTEL_ID, month: 10, year: 2026, status: "sent", createdAt: "2026-10-01T00:00:00.000Z" }] }));
  await page.route(`**/api/manager/motels/${MOTEL_ID}/billing/periods/${BILLING_PERIOD_ID}/invoices`, (route) => route.fulfill({ json: invoices }));
  await page.route(`**/api/manager/motels/${MOTEL_ID}/renters`, (route) => route.fulfill({ json: [renter] }));
  const proof = (invoiceId: string, status: "pending" | "approved" | "rejected", signedUrl: string): ManagerPaymentProof => ({ id: `proof-${invoiceId}`, invoiceId, renterId: RENTER_ID, status, contentType: "image/jpeg", size: 20, submittedAt: "2026-10-01T00:00:00.000Z", reviewedAt: null, reviewedByManagerId: null, rejectionReason: null, signedUrl });
  await page.route("**/api/manager/motels/*/billing/invoices/*/payment-proof", async (route) => {
    const invoiceId = route.request().url().split("/billing/invoices/")[1]?.split("/")[0] ?? "";
    await route.fulfill({ json: invoiceId === "invoice-cash" ? null : proof(invoiceId, "pending", `https://private.invalid/${invoiceId}`) });
  });
  await page.route("**/api/manager/motels/*/billing/invoices/*/payment-proof/reject", async (route) => {
    const data = route.request().postDataJSON() as { reason: string };
    const invoiceId = route.request().url().split("/billing/invoices/")[1]?.split("/")[0] ?? "";
    const rejected: PaymentProof = { id: `proof-${invoiceId}`, invoiceId, status: "rejected", contentType: "image/jpeg", size: 20, submittedAt: "2026-10-01T00:00:00.000Z", reviewedAt: "2026-10-01T00:00:00.000Z", rejectionReason: data.reason };
    await route.fulfill({ json: rejected });
  });
  await page.route(`**/api/manager/motels/${MOTEL_ID}/billing/invoices/*/payment-proof/approve`, (route) => route.fulfill({ json: { invoiceId: "invoice-approve", paymentStatus: "paid", paidAt: "2026-10-01T00:00:00.000Z", paymentMethod: "bank_transfer" } }));
  await page.route(`**/api/manager/motels/${MOTEL_ID}/billing/invoices/*/cash-confirmation`, (route) => route.fulfill({ json: { invoiceId: "invoice-cash", paymentStatus: "paid", paidAt: "2026-10-01T00:00:00.000Z", paymentMethod: "cash" } }));

  await page.goto(`/billing/${BILLING_PERIOD_ID}/invoices?motel=${MOTEL_ID}`);
  await expect(page.getByRole("heading", { name: /Hóa đơn tháng/ })).toBeVisible();
  const firstInvoice = page.locator("article").filter({ hasText: "P.101" });
  await expect(firstInvoice.locator("p").filter({ hasText: "3.615.000 ₫" })).toBeVisible();
  await firstInvoice.getByText("Xem mã QR").click();
  await expect(firstInvoice.getByRole("img", { name: "Mã QR thanh toán hóa đơn phòng P.101" })).toBeVisible();
  await expect(firstInvoice.getByRole("img", { name: "Chứng từ thanh toán" })).toBeVisible();
  const privateUrl = await firstInvoice.getByRole("img", { name: "Chứng từ thanh toán" }).getAttribute("src");
  expect(privateUrl).toContain("private.invalid");
  expect(await firstInvoice.innerText()).not.toContain(privateUrl);
  expect(await firstInvoice.locator("a").count()).toBe(0);

  const proofCard = page.getByRole("region", { name: "Chứng từ thanh toán" }).first();
  await expect(proofCard.getByRole("img", { name: "Chứng từ thanh toán" })).toBeVisible();
  await expect(proofCard.getByRole("button", { name: "Duyệt chứng từ" })).toBeEnabled();
  const reject = proofCard.getByRole("button", { name: "Từ chối chứng từ" });
  await expect(reject).toBeDisabled();
  await proofCard.getByLabel("Lý do từ chối").fill("Ảnh chưa rõ");
  await reject.click();
  await expect(page.getByText("Chứng từ đã bị từ chối. Hóa đơn vẫn chưa thanh toán.")).toBeVisible();
  await expect(proofCard.getByRole("button", { name: "Từ chối chứng từ" })).toBeDisabled();

  const approveCard = page.locator("article").filter({ hasText: "P.102" });
  await approveCard.getByRole("button", { name: "Duyệt chứng từ" }).click();
  await expect(approveCard.getByText("Đã ghi nhận thanh toán qua chuyển khoản. Trạng thái: paid.")).toBeVisible();

  const cashCard = page.locator("article").filter({ hasText: "P.103" });
  page.once("dialog", (dialog) => dialog.accept());
  await cashCard.getByRole("button", { name: "Xác nhận đã nhận tiền mặt" }).click();
  await expect(cashCard.getByText("Đã xác nhận thanh toán bằng tiền mặt. Trạng thái: paid.")).toBeVisible();

  for (const width of [360, 375, 430, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = await page.locator("main").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(width);
  }
});
