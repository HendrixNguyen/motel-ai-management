import { describe, expect, it } from "vitest";
import { formatVnd } from "@/lib/format/vnd";
import { paymentProofLabel } from "@/lib/payment-proof";

describe("billing presentation contracts", () => {
  it("formats invoice totals from digit strings without losing VND precision", () => {
    expect(formatVnd("9007199254740993")).toBe("9.007.199.254.740.993 ₫");
    expect(formatVnd("3500000")).toBe("3.500.000 ₫");
  });

  it("labels all server payment proof states distinctly", () => {
    expect(paymentProofLabel("pending")).toBe("Đang chờ duyệt");
    expect(paymentProofLabel("approved")).toBe("Đã duyệt");
    expect(paymentProofLabel("rejected")).toBe("Cần gửi lại");
  });
});
