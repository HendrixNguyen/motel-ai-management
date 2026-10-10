import { describe, expect, it } from "vitest";
import { validatePaymentProofFile } from "@/lib/payment-proof";

describe("payment proof file validation", () => {
  it("accepts one jpeg/png within size limit", () => {
    expect(validatePaymentProofFile(new File(["image"], "receipt.jpg", { type: "image/jpeg" }))).toEqual({ ok: true });
  });
  it("rejects unsupported, empty, and oversized files", () => {
    expect(validatePaymentProofFile(new File(["x"], "receipt.gif", { type: "image/gif" }))).toMatchObject({ ok: false });
    expect(validatePaymentProofFile(new File([], "receipt.png", { type: "image/png" }))).toMatchObject({ ok: false });
    const file = new File([new Uint8Array(10)], "receipt.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 + 1 });
    expect(validatePaymentProofFile(file)).toMatchObject({ ok: false });
  });
});
