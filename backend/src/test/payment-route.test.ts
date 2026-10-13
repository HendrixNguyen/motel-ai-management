import { expect, test } from "bun:test";
import { paymentRoutes } from "@/modules/payment/payment.route";

test("payment proof route uses numeric byte maxSize supported by Elysia 1.4", () => {
  const route = paymentRoutes.routes.find((item) => item.path === "/renter/invoices/:invoiceId/payment-proof" && item.method === "POST");
  expect(route).toBeDefined();
  const bodySchema = route?.hooks.body as { properties?: { file?: { maxSize?: number } } };
  expect(bodySchema?.properties?.file?.maxSize).toBe(5_000_000);
});

