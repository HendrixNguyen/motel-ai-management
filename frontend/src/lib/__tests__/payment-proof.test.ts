import { describe, expect, it } from "vitest";
import { validatePaymentProofFile } from "@/lib/payment-proof";

describe("payment proof file validation", () => {
  it("accepts files up to exactly 5,000,000 bytes", () => {
    const accepted = new File([new Uint8Array(1)], "receipt.jpg", { type: "image/jpeg" });
    Object.defineProperty(accepted, "size", { value: 5_000_000 });
    const rejected = new File([new Uint8Array(1)], "receipt.jpg", { type: "image/jpeg" });
    Object.defineProperty(rejected, "size", { value: 5_000_001 });
    expect(validatePaymentProofFile(accepted)).toEqual({ ok: true });
    expect(validatePaymentProofFile(rejected)).toMatchObject({ ok: false });
  });
  it("labels oversized files with the 5 MB limit", () => {
    const file = new File([new Uint8Array(1)], "receipt.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 5_000_001 });
    expect(validatePaymentProofFile(file)).toMatchObject({ ok: false, error: "Ảnh vượt quá giới hạn 5 MB" });
  });
  it("rejects unsupported, empty, and oversized files", () => {
    expect(validatePaymentProofFile(new File(["x"], "receipt.gif", { type: "image/gif" }))).toMatchObject({ ok: false });
    expect(validatePaymentProofFile(new File([], "receipt.png", { type: "image/png" }))).toMatchObject({ ok: false });
    const file = new File([new Uint8Array(10)], "receipt.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 5_000_001 });
    expect(validatePaymentProofFile(file)).toMatchObject({ ok: false });
  });
});
