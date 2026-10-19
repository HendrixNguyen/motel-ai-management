import { expect, test } from "bun:test";
import { paymentRoutes } from "@/modules/payment/payment.route";
import { renterAuth } from "@/middleware/renter-auth";
import { managerAuth } from "@/middleware/manager-auth";

test("payment route exposes renter and manager actions with bound validation", () => {
  const rows = paymentRoutes.routes;
  expect(rows.filter((r) => r.path.includes("payment-proof")).map((r) => `${r.method} ${r.path}`)).toContain("POST /renter/invoices/:invoiceId/payment-proof");
  expect(rows.map((r) => r.path)).toContain("/manager/motels/:motelId/billing/invoices/:invoiceId/payment-proof/approve");
  expect(rows.map((r) => r.path)).toContain("/manager/motels/:motelId/billing/invoices/:invoiceId/cash-confirmation");
  expect(rows.find((r) => r.path.endsWith("/payment-proof/reject"))?.hooks.body).toBeDefined();
  expect(renterAuth).toBeDefined();
  expect(managerAuth).toBeDefined();
});

test("payment proof route uses numeric byte maxSize supported by Elysia 1.4", () => {
  const route = paymentRoutes.routes.find((item) => item.path === "/renter/invoices/:invoiceId/payment-proof" && item.method === "POST");
  expect(route).toBeDefined();
  const bodySchema = route?.hooks.body as { properties?: { file?: { maxSize?: number } } };
  expect(bodySchema?.properties?.file?.maxSize).toBe(5_000_000);
});
