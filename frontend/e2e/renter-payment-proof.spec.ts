import { expect, test } from "@playwright/test";
import { RENTER_ID, MOTEL_ID } from "../test/lib/api/fixtures";

test("renter uploads payment proof and sees pending status without leaking URLs", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "renter_session", value: "test-renter", domain: "localhost", path: "/" },
  ]);

  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: { renterId: RENTER_ID, motelId: MOTEL_ID },
    }),
  );

  await page.route("**/api/renter/me", (route) =>
    route.fulfill({
      json: {
        renter: {
          id: RENTER_ID,
          name: "Nguyễn Văn A",
          phone: "84901234568",
          motelId: MOTEL_ID,
          idNumber: null,
          idCardFrontUploaded: false,
          idCardBackUploaded: false,
          roomId: "room-1",
          zaloOaId: null,
          isOaFollower: false,
          status: "active",
          createdAt: "2026-10-01T00:00:00.000Z",
        },
        motel: {
          id: MOTEL_ID,
          code: "MOTEL",
          name: "Nhà trọ mẫu",
          address: "123 Đường ABC",
          bankAccount: {
            bankCode: "970422",
            accountNumber: "0123456789",
            accountName: "NGUYEN VAN A",
          },
        },
        room: {
          id: "room-1",
          name: "P.101",
          floor: 1,
          status: "occupied",
        },
      },
    }),
  );

  const invoiceId = "invoice-proof-1";
  await page.route("**/api/renter/invoices", (route) =>
    route.fulfill({
      json: [
        {
          id: invoiceId,
          billingPeriodId: "period-1",
          periodMonth: 10,
          periodYear: 2026,
          roomId: "room-1",
          roomName: "P.101",
          totalAmount: "3615000",
          paymentStatus: "unpaid",
          paymentMethod: null,
          dueDate: null,
        },
      ],
    }),
  );
  await page.route(`**/api/renter/invoices/${invoiceId}`, (route) =>
    route.fulfill({
      json: {
        id: invoiceId,
        billingPeriodId: "period-1",
        periodMonth: 10,
        periodYear: 2026,
        roomId: "room-1",
        roomName: "P.101",
        rentAmount: "3500000",
        electricityUsage: "20.00",
        electricityCost: "70000",
        waterUsage: "3.00",
        waterCost: "45000",
        otherFees: [],
        totalAmount: "3615000",
        paymentStatus: "unpaid",
        paymentMethod: null,
        paidAt: null,
        dueDate: null,
        bankAccount: {
          bankCode: "970422",
          accountNumber: "0123456789",
          accountName: "NGUYEN VAN A",
        },
        transferDescription: "MOTEL P101 10-2026",
        meterPhotos: [],
      },
    }),
  );
  await page.route(`**/api/renter/invoices/${invoiceId}/payment-proof`, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: null });
    }
    if (route.request().method() === "POST") {
      return route.fulfill({
        json: {
          id: "proof-1",
          invoiceId,
          status: "pending",
          contentType: "image/jpeg",
          size: 20,
          submittedAt: "2026-10-01T00:00:00.000Z",
          reviewedAt: null,
          rejectionReason: null,
          signedUrl: "https://private.invalid/test-proof.jpg",
        },
      });
    }
    return route.fallback();
  });

  await page.goto(`/portal/bills/${invoiceId}`);
  await expect(page.getByRole("heading", { name: "Chi tiết hóa đơn" })).toBeVisible();

  const fileInput = page.locator("#payment-proof-file");
  await expect(fileInput).toBeVisible();
  const buffer = Buffer.from("fake-jpeg");
  await fileInput.setInputFiles({
    name: "proof.jpg",
    mimeType: "image/jpeg",
    buffer,
  });

  await page.getByRole("button", { name: "Gửi chứng từ" }).click();

  await expect(page.getByText("Đang chờ duyệt")).toBeVisible();
  await expect(page.getByText("private.invalid")).not.toBeVisible();
  await expect(page.getByText("signedUrl")).not.toBeVisible();
  await expect(page.getByText("credentials")).not.toBeVisible();
});
