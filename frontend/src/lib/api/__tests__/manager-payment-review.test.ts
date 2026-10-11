import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { approvePaymentProof, confirmInvoiceCash, getManagerPaymentProof, rejectPaymentProof } from "@/lib/api/billing.client";
import { MANAGER_ID, MOTEL_ID, RENTER_ID } from "./fixtures";
import type { InvoicePaymentResult, ManagerPaymentProof, PaymentProof } from "@/lib/api/types";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as typeof fetch;

function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }

beforeEach(() => fetchMock.mockReset());

describe("manager payment review API", () => {
  it("reads proof through the selected motel and invoice", async () => {
    const proof: ManagerPaymentProof = { id: "proof", invoiceId: "invoice", renterId: "renter", status: "pending", contentType: "image/jpeg", size: 100, submittedAt: "2026-10-01T00:00:00.000Z", reviewedAt: null, reviewedByManagerId: null, rejectionReason: null, signedUrl: "https://private.invalid/proof" };
    fetchMock.mockResolvedValue(response(proof));
    await expect(getManagerPaymentProof("motel/a", "invoice b")).resolves.toEqual(proof);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/manager/motels/motel%2Fa/billing/invoices/invoice%20b/payment-proof");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "GET" });
  });

  it("rejects blank reasons before sending", async () => {
    await expect(rejectPaymentProof("motel", "invoice", " \n ")).rejects.toThrow("Vui lòng nhập lý do từ chối.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends distinct approve, reject, and cash actions to manager endpoints", async () => {
    const paid: InvoicePaymentResult = { invoiceId: "invoice", paymentStatus: "paid", paidAt: "2026-10-01T00:00:00.000Z", paymentMethod: "bank_transfer" };
    const rejected: PaymentProof = { id: "proof", invoiceId: "invoice", status: "rejected", contentType: "image/jpeg", size: 100, submittedAt: "2026-10-01T00:00:00.000Z", reviewedAt: "2026-10-01T00:00:00.000Z", rejectionReason: "Ảnh chưa rõ" };
    fetchMock.mockResolvedValueOnce(response(paid)).mockResolvedValueOnce(response(rejected)).mockResolvedValueOnce(response({ ...paid, paymentMethod: "cash" }));
    await approvePaymentProof("motel", "invoice");
    await rejectPaymentProof("motel", "invoice", "Ảnh chưa rõ");
    await confirmInvoiceCash("motel", "invoice");
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method, init?.body])).toEqual([
      ["/api/manager/motels/motel/billing/invoices/invoice/payment-proof/approve", "POST", undefined],
      ["/api/manager/motels/motel/billing/invoices/invoice/payment-proof/reject", "POST", JSON.stringify({ reason: "Ảnh chưa rõ" })],
      ["/api/manager/motels/motel/billing/invoices/invoice/cash-confirmation", "POST", undefined],
    ]);
  });

  it("preserves server conflict status for canonical refresh handling", async () => {
    fetchMock.mockResolvedValue(response({ error: "Hóa đơn đã được xử lý", code: "CONFLICT" }, 409));
    await expect(approvePaymentProof("motel", "invoice")).rejects.toMatchObject({ status: 409, code: "CONFLICT" } satisfies Partial<ApiError>);
  });

  it("keeps proof review scoped to manager motel and invoice IDs", async () => {
    fetchMock.mockResolvedValue(response(null));
    const invoiceId = "e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b";
    await getManagerPaymentProof(MOTEL_ID, invoiceId);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/manager/motels/${MOTEL_ID}/billing/invoices/${invoiceId}/payment-proof`);
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain(`/renters/${RENTER_ID}`);
  });

  it("keeps manager payment actions out of renter API module", async () => {
    const renterApi = await import("@/lib/api/renter");
    expect(Object.keys(renterApi)).not.toEqual(expect.arrayContaining(["approvePaymentProof", "confirmInvoiceCash", "rejectPaymentProof"]));
  });
});
