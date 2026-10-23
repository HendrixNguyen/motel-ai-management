// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import InvoiceActions from "@/components/manager/invoice-actions";
import {
  approvePaymentProof,
  confirmInvoiceCash,
  markInvoiceOverdue,
  rejectPaymentProof,
} from "@/lib/api/billing.client";
import { ApiError } from "@/lib/api/client";
import { createRenterMagicLink } from "@/lib/api/renters.client";
import type { InvoiceResponse, ManagerPaymentProof } from "@/lib/api/types";

const refresh = vi.fn();
const getProof = vi.hoisted(() => vi.fn());
const createMagicLink = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/renters.client", () => ({ createRenterMagicLink: createMagicLink }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api/billing.client", () => ({
  approvePaymentProof: vi.fn(),
  confirmInvoiceCash: vi.fn(),
  getManagerPaymentProof: getProof,
  markInvoiceOverdue: vi.fn(),
  rejectPaymentProof: vi.fn(),
}));
vi.mock("qrcode", () => ({ default: { toCanvas: vi.fn() } }));

const invoice: InvoiceResponse = {
  id: "invoice-1",
  billingPeriodId: "period-1",
  roomId: "room-1",
  roomName: "P.101",
  renterId: "renter-1",
  motelId: "motel-1",
  rentAmount: "3500000",
  electricityUsage: "20.00",
  electricityCost: "70000",
  waterUsage: "3.00",
  waterCost: "45000",
  otherFees: [],
  totalAmount: "9007199254740993",
  qrCodeData: "000201010212",
  paymentStatus: "unpaid",
  paymentMethod: null,
  paidAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
};
const proof: ManagerPaymentProof = {
  id: "proof-1",
  invoiceId: invoice.id,
  renterId: invoice.renterId,
  status: "pending",
  contentType: "image/jpeg",
  size: 100,
  submittedAt: "2026-10-01T00:00:00.000Z",
  reviewedAt: null,
  reviewedByManagerId: null,
  rejectionReason: null,
  signedUrl: "https://private.invalid/proof",
};

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  getProof.mockResolvedValue(proof);
  createMagicLink.mockResolvedValue({ url: "https://motel.example/r/token" });
  vi.mocked(approvePaymentProof).mockResolvedValue({
    invoiceId: invoice.id,
    paymentStatus: "paid",
    paymentMethod: "bank_transfer",
    paidAt: "2026-10-01T00:00:00.000Z",
  });
  vi.mocked(rejectPaymentProof).mockResolvedValue({
    ...proof,
    status: "rejected",
    rejectionReason: "Ảnh chưa rõ",
  });
  vi.mocked(confirmInvoiceCash).mockResolvedValue({
    invoiceId: invoice.id,
    paymentStatus: "paid",
    paymentMethod: "cash",
    paidAt: "2026-10-01T00:00:00.000Z",
  });
  vi.mocked(markInvoiceOverdue).mockResolvedValue({ ...invoice, paymentStatus: "overdue" });
});

describe("invoice payment review", () => {
  it("prepares assisted Zalo message only after billing period is sent", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue({
      location: { href: "" },
      close: vi.fn(),
    } as never);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(
      <InvoiceActions
        motelId="motel-1"
        invoice={invoice}
        bankAccount={null}
        renterPhone="84901234567"
        billingPeriod={{ month: 2, year: 2026 }}
        allowAssistedSend
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Chuẩn bị tin nhắn Zalo" }));
    await waitFor(() => expect(createRenterMagicLink).toHaveBeenCalledWith("motel-1", "renter-1"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("3.500.000")));
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect((await screen.findByText(/Tin chưa được gửi/)).textContent).toContain("Tin chưa được gửi");
  });

  it("gives the QR disclosure keyboard-visible focus", async () => {
    render(<InvoiceActions motelId="motel-1" invoice={invoice} bankAccount={null} billingPeriod={{ month: 2, year: 2026 }} allowAssistedSend={false} />);
    const summary = screen.getByText("Xem mã QR");
    expect((summary as HTMLElement).className).toContain("focus-visible:outline-2");
    expect((summary as HTMLElement).className).toContain("focus-visible:outline-primary");
  });

  it("renders exact VND and QR data without exposing payload or proof URL as text", async () => {
    render(
      <InvoiceActions
        motelId="motel-1"
        invoice={invoice}
        bankAccount={{ bankCode: "970436", accountNumber: "123456789", accountName: "NHÀ TRỌ" }}
        billingPeriod={{ month: 2, year: 2026 }}
        allowAssistedSend={false}
      />,
    );
    fireEvent.click(screen.getByText("Xem mã QR"));
    expect(await screen.findByText("9.007.199.254.740.993 ₫")).toBeTruthy();
    expect(screen.queryByText(invoice.qrCodeData!)).toBeNull();
    await screen.findByRole("img", { name: "Chứng từ thanh toán" });
    expect(document.body.textContent).not.toContain(proof.signedUrl);
    expect(document.querySelector("a[href*='private.invalid']")).toBeNull();
  });

  it.each([500, 502])("redacts private details from proof load ApiError %s", async (status) => {
    getProof.mockRejectedValueOnce(
      new ApiError(status, "INTERNAL_ERROR", "database host private-db.internal", {
        connectionString: "postgres://secret",
      }),
    );
    render(<InvoiceActions motelId="motel-1" invoice={invoice} bankAccount={null} billingPeriod={{ month: 2, year: 2026 }} allowAssistedSend={false} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Không thể tải chứng từ.");
    expect(document.body.textContent).not.toContain("private-db.internal");
    expect(document.body.textContent).not.toContain("postgres://secret");
  });

  it.each([500, 502])("redacts private details from mutation ApiError %s", async (status) => {
    vi.mocked(approvePaymentProof).mockRejectedValueOnce(
      new ApiError(status, "INTERNAL_ERROR", "database host internal-db.private:5432", {
        password: "hunter2",
      }),
    );
    render(<InvoiceActions motelId="motel-1" invoice={invoice} bankAccount={null} billingPeriod={{ month: 2, year: 2026 }} allowAssistedSend={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Duyệt chứng từ" }));
    await waitFor(() =>
      expect(document.body.textContent).toContain(
        "Không thể cập nhật thanh toán. Vui lòng thử lại.",
      ),
    );
    expect(document.body.textContent).not.toContain("internal-db.private");
    expect(document.body.textContent).not.toContain("hunter2");
  });

  it("renders returned rejection reason immediately while proof refresh runs", async () => {
    render(<InvoiceActions motelId="motel-1" invoice={invoice} bankAccount={null} billingPeriod={{ month: 2, year: 2026 }} allowAssistedSend={false} />);
    await screen.findByRole("img", { name: "Chứng từ thanh toán" });
    fireEvent.change(screen.getByLabelText("Lý do từ chối"), { target: { value: "Ảnh chưa rõ" } });
    fireEvent.click(screen.getByRole("button", { name: "Từ chối chứng từ" }));
    expect(
      await screen.findByText("Chứng từ đã bị từ chối. Hóa đơn vẫn chưa thanh toán."),
    ).toBeTruthy();
  });

  it("keeps server read failures in safe retry UI", async () => {
    getProof.mockRejectedValueOnce(new ApiError(503, "INTERNAL_ERROR", "private host"));
    render(<InvoiceActions motelId="motel-1" invoice={invoice} bankAccount={null} billingPeriod={{ month: 2, year: 2026 }} allowAssistedSend={false} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải chứng từ.");
    expect(document.body.textContent).not.toContain("private host");
  });

  it("refreshes proof and invoice state on conflict", async () => {
    vi.mocked(approvePaymentProof).mockRejectedValueOnce(
      new ApiError(409, "CONFLICT", "Trạng thái đã đổi", { server: "private details" }),
    );
    render(<InvoiceActions motelId="motel-1" invoice={invoice} bankAccount={null} billingPeriod={{ month: 2, year: 2026 }} allowAssistedSend={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Duyệt chứng từ" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Trạng thái hóa đơn đã thay đổi. Đang tải lại dữ liệu mới nhất.",
    );
    await waitFor(() => expect(getProof).toHaveBeenCalledTimes(2));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("private details");
  });

  it.each([
    ["approve", "Duyệt chứng từ"],
    ["reject", "Từ chối chứng từ"],
    ["cash", "Xác nhận đã nhận tiền mặt"],
    ["overdue", "Đánh dấu quá hạn"],
  ] as const)(
    "prevents duplicate %s submission while request is pending",
    async (action, label) => {
      let resolveRequest: (value: never) => void = () => undefined;
      if (action === "approve")
        vi.mocked(approvePaymentProof).mockReturnValueOnce(
          new Promise((resolve) => {
            resolveRequest = resolve;
          }),
        );
      else if (action === "reject")
        vi.mocked(rejectPaymentProof).mockReturnValueOnce(
          new Promise((resolve) => {
            resolveRequest = resolve;
          }),
        );
      else if (action === "cash")
        vi.mocked(confirmInvoiceCash).mockReturnValueOnce(
          new Promise((resolve) => {
            resolveRequest = resolve;
          }),
        );
      else
        vi.mocked(markInvoiceOverdue).mockReturnValueOnce(
          new Promise((resolve) => {
            resolveRequest = resolve;
          }),
        );
      render(<InvoiceActions motelId="motel-1" invoice={invoice} bankAccount={null} billingPeriod={{ month: 2, year: 2026 }} allowAssistedSend={false} />);
      const button = (await screen.findAllByRole("button", { name: label }))[0]!;
      if (action === "reject")
        fireEvent.change(screen.getByLabelText("Lý do từ chối"), {
          target: { value: "Ảnh chưa rõ" },
        });
      if (action === "cash") vi.stubGlobal("confirm", () => true);
      fireEvent.click(button);
      fireEvent.click(button);
      await waitFor(() =>
        expect(
          vi.mocked(approvePaymentProof).mock.calls.length +
            vi.mocked(rejectPaymentProof).mock.calls.length +
            vi.mocked(confirmInvoiceCash).mock.calls.length +
            vi.mocked(markInvoiceOverdue).mock.calls.length,
        ).toBe(1),
      );
      expect((button as HTMLButtonElement).disabled).toBe(true);
      resolveRequest(undefined as never);
      vi.unstubAllGlobals();
    },
  );
});
