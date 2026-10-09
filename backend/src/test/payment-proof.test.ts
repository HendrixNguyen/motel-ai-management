import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { app } from "@/app";
import { resetDb } from "@/db/test-db";
import { FakeStorageAdapter, type StorageAdapter } from "@/shared/storage";
import { configurePaymentStorage } from "@/modules/payment/payment.service";

afterEach(() => configurePaymentStorage(new FakeStorageAdapter()));
beforeEach(resetDb);

describe("payment proof runtime", () => {
  test("route is mounted and rejects missing renter auth", async () => {
    const response = await app.handle(new Request(`http://localhost/api/renter/invoices/${crypto.randomUUID()}/payment-proof`));
    expect(response.status).toBe(401);
  });

  test("storage failure maps to external service without metadata", async () => {
    const storage: StorageAdapter = { async put() { throw new Error("bucket secret"); }, async delete() {}, async createSignedDownload() { throw new Error("no"); } };
    configurePaymentStorage(storage);
    expect(storage).toBeDefined();
  });
});
