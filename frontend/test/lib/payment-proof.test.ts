import { describe, expect, it } from "vitest";
import {
  PAYMENT_PROOF_MAX_BYTES,
  PAYMENT_PROOF_TYPES,
  paymentProofLabel,
  validatePaymentProofBytes,
  validatePaymentProofFile,
} from "@/lib/payment-proof";
import { parseVndDigits } from "@/lib/format/vnd";

describe("VND wire-format boundaries", () => {
  it.each([
    ["0", "0"],
    ["007", "7"],
    ["3.500.000", "3500000"],
    [" 3.500.000 ", "3500000"],
  ])("normalizes valid input %s to digit string", (input, output) => {
    expect(parseVndDigits(input)).toBe(output);
  });
  it.each(["", "-1", "+1", "1.5", "1.500.00", "1,500", "3 500", "12₫", "abc"])(
    "rejects malformed amount %s without guessing",
    (input) => {
      expect(parseVndDigits(input)).toBeNull();
    },
  );
});

describe("payment proof file boundary", () => {
  it("accepts valid JPEG and PNG bytes through exact byte limit", async () => {
    expect(validatePaymentProofFile(new File([""], "empty.jpg", { type: "image/jpeg" }))).toEqual({
      ok: false,
      error: "Ảnh không có dữ liệu",
    });
    expect(
      validatePaymentProofFile(
        new File([new Uint8Array(PAYMENT_PROOF_MAX_BYTES)], "large.jpg", { type: "image/jpeg" }),
      ),
    ).toEqual({ ok: true });
    expect(
      await validatePaymentProofBytes(
        new File([new Uint8Array([0xff, 0xd8, 0xff])], "proof.jpg", { type: "image/jpeg" }),
      ),
    ).toEqual({ ok: true });
    expect(
      await validatePaymentProofBytes(
        new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "proof.png", {
          type: "image/png",
        }),
      ),
    ).toEqual({ ok: true });
  });
  it("rejects unsupported MIME, oversize, and mismatched magic bytes", async () => {
    expect(
      validatePaymentProofFile(new File(["gif"], "proof.gif", { type: "image/gif" })),
    ).toMatchObject({ ok: false, error: "Chỉ nhận ảnh JPG hoặc PNG" });
    expect(
      validatePaymentProofFile(
        new File([new Uint8Array(PAYMENT_PROOF_MAX_BYTES + 1)], "large.png", { type: "image/png" }),
      ),
    ).toMatchObject({ ok: false, error: "Ảnh vượt quá giới hạn 5 MB" });
    expect(
      await validatePaymentProofBytes(
        new File(["not an image"], "spoof.png", { type: "image/png" }),
      ),
    ).toMatchObject({ ok: false, error: "Nội dung ảnh không hợp lệ" });
  });
  it("labels all proof states", () => {
    expect(PAYMENT_PROOF_TYPES).toEqual(["image/jpeg", "image/png"]);
    expect(paymentProofLabel("pending")).toBe("Đang chờ duyệt");
    expect(paymentProofLabel("approved")).toBe("Đã duyệt");
    expect(paymentProofLabel("rejected")).toBe("Cần gửi lại");
  });
});
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
    expect(validatePaymentProofFile(file)).toMatchObject({
      ok: false,
      error: "Ảnh vượt quá giới hạn 5 MB",
    });
  });
  it("rejects unsupported, empty, and oversized files", () => {
    expect(
      validatePaymentProofFile(new File(["x"], "receipt.gif", { type: "image/gif" })),
    ).toMatchObject({ ok: false });
    expect(
      validatePaymentProofFile(new File([], "receipt.png", { type: "image/png" })),
    ).toMatchObject({ ok: false });
    const file = new File([new Uint8Array(10)], "receipt.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 5_000_001 });
    expect(validatePaymentProofFile(file)).toMatchObject({ ok: false });
  });
});
