import { expect, test } from "@playwright/test";
import { BILLING_PERIOD_ID, MOTEL_ID } from "../test/lib/api/fixtures";
import type { InvoiceResponse } from "../src/lib/api/types";

async function useManagerSession(page: import("@playwright/test").Page, session: string) {
  await page.context().clearCookies();
  await page.context().addCookies([
    { name: "manager_session", value: session, domain: "localhost", path: "/" },
  ]);
}

test.describe("manager billing capture and invoices", () => {
  test("rejects decreasing meter value with a visible error", async ({ page }) => {
    await useManagerSession(page, "capture-session");

    await page.goto(`/billing?motel=${MOTEL_ID}`);

    await page
      .getByRole("link", { name: /Tháng 10\/2026/, exact: false })
      .click();

    await expect(page.getByRole("heading", { name: /Tháng 10\/2026/, exact: false })).toBeVisible();

    await page.getByLabel("Điện (kWh)").fill("90");

    await page.getByRole("button", { name: "Lưu nháp", exact: true }).click();

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ." }),
    ).toBeVisible();
  });

  test("generates invoices with expected integer VND arithmetic", async ({ page }) => {
    await useManagerSession(page, "capture-session-billing-arithmetic");
    await page.goto(`/billing?motel=${MOTEL_ID}`);

    await page
      .getByRole("link", { name: /Tháng 10\/2026/, exact: false })
      .click();

    await expect(page.getByRole("heading", { name: /Tháng 10\/2026/, exact: false })).toBeVisible();

    await page.getByLabel("Điện (kWh)").fill("120");
    await page.getByLabel("Nước (m³)").fill("5");

    await page.getByRole("button", { name: "Tạo hóa đơn", exact: true }).click();

    await expect(page).toHaveURL(
      `/billing/${BILLING_PERIOD_ID}/invoices?motel=${encodeURIComponent(MOTEL_ID)}`,
    );

    const invoiceCard = page.locator("article").filter({ hasText: "P.101" }).first();

    await expect(invoiceCard.getByText("3.500.000 ₫")).toBeVisible();
    await expect(invoiceCard.getByText(/Điện \(20\.00\)/)).toBeVisible();
    await expect(invoiceCard.getByText("70.000 ₫")).toBeVisible();
    await expect(invoiceCard.getByText(/Nước \(3\.00\)/)).toBeVisible();
    await expect(invoiceCard.getByText("45.000 ₫")).toBeVisible();
    await expect(invoiceCard.getByText("Vệ sinh chung")).toBeVisible();
    await expect(invoiceCard.getByText("50.000 ₫")).toBeVisible();
    await expect(invoiceCard.getByText("Gửi xe")).toBeVisible();
    await expect(invoiceCard.getByText("100.000 ₫")).toBeVisible();
    await expect(
      invoiceCard
        .locator("p.whitespace-nowrap.font-heading")
        .filter({ hasText: "3.765.000 ₫" }),
    ).toBeVisible();

    const response = await page.request.get(
      `/api/manager/motels/${MOTEL_ID}/billing/periods/${BILLING_PERIOD_ID}/invoices`,
    );
    expect(response.status()).toBe(200);
    const invoices = (await response.json()) as InvoiceResponse[];
    expect(invoices.length).toBeGreaterThan(0);
    const invoice = invoices[0]!;

    const rent = BigInt(invoice.rentAmount);
    const electricity = BigInt(invoice.electricityCost);
    const water = BigInt(invoice.waterCost);
    const fees = invoice.otherFees.reduce((total, fee) => total + BigInt(fee.amount), 0n);
    const expectedTotal = (rent + electricity + water + fees).toString();

    expect(invoice.electricityUsage).toBe("20.00");
    expect(invoice.waterUsage).toBe("3.00");
    expect(invoice.totalAmount).toBe(expectedTotal);
  });

  test("isolates invoice state between manager sessions", async ({ page }) => {
    await useManagerSession(page, "capture-session-billing-a");

    await page.goto(`/billing?motel=${MOTEL_ID}`);
    await page
      .getByRole("link", { name: /Tháng 10\/2026/, exact: false })
      .click();
    await expect(page.getByRole("heading", { name: /Tháng 10\/2026/, exact: false })).toBeVisible();

    await page.getByLabel("Điện (kWh)").fill("120");
    await page.getByLabel("Nước (m³)").fill("5");
    await page.getByRole("button", { name: "Lưu nháp", exact: true }).click();
    await page.getByRole("button", { name: "Tạo hóa đơn", exact: true }).click();

    let response = await page.request.get(
      `/api/manager/motels/${MOTEL_ID}/billing/periods/${BILLING_PERIOD_ID}/invoices`,
    );
    expect(response.status()).toBe(200);
    let invoices = (await response.json()) as InvoiceResponse[];
    expect(invoices.length).toBeGreaterThan(0);
    const first = invoices[0]!;
    expect(first.electricityUsage).toBe("20.00");
    expect(first.waterUsage).toBe("3.00");

    await useManagerSession(page, "capture-session-billing-b");

    await page.goto(`/billing?motel=${MOTEL_ID}`);
    await page
      .getByRole("link", { name: /Tháng 10\/2026/, exact: false })
      .click();
    await expect(page.getByRole("heading", { name: /Tháng 10\/2026/, exact: false })).toBeVisible();

    await page.getByLabel("Điện (kWh)").fill("130");
    await page.getByLabel("Nước (m³)").fill("6");
    await page.getByRole("button", { name: "Lưu nháp", exact: true }).click();
    await page.getByRole("button", { name: "Tạo hóa đơn", exact: true }).click();

    response = await page.request.get(
      `/api/manager/motels/${MOTEL_ID}/billing/periods/${BILLING_PERIOD_ID}/invoices`,
    );
    expect(response.status()).toBe(200);
    invoices = (await response.json()) as InvoiceResponse[];
    expect(invoices.length).toBeGreaterThan(0);
    const second = invoices[0]!;
    expect(second.electricityUsage).toBe("30.00");
    expect(second.waterUsage).toBe("4.00");
  });
});
