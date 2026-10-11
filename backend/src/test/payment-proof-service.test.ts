import { describe, expect, test } from "bun:test";
import { submitPaymentProof } from "@/modules/payment/payment.service";
import { AppError } from "@/shared/errors";

const session = { renterId: "renter-id", motelId: "motel-id" } as Parameters<typeof submitPaymentProof>[0];

describe("submitPaymentProof size boundary", () => {
  test("accepts a 5,000,000-byte proof and reaches invoice lookup", async () => {
    const error = await submitPaymentProof(session, "invoice-id", new File([new Uint8Array(5_000_000)], "proof.jpg", { type: "image/jpeg" })).catch((value: unknown) => value);
    expect(String(error)).toContain('select "invoices"');
    expect(error).not.toMatchObject({ code: "VALIDATION_ERROR", message: "Tệp vượt quá giới hạn 5 MB" });
  });

  test("rejects 5,000,001 bytes with validation error before invoice lookup", async () => {
    await expect(submitPaymentProof(session, "invoice-id", new File([new Uint8Array(5_000_001)], "proof.jpg", { type: "image/jpeg" }))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Tệp vượt quá giới hạn 5 MB",
    });
  });
});
