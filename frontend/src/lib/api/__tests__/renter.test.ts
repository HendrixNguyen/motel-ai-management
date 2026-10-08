import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRenterMe, listRenterPeriods, listRenterInvoices, getRenterContract, requestRenterContractOtp, verifyRenterContractOtp, listRenterTickets, createRenterTicket, exchangeRenterMagicLink } from "@/lib/api/renter";
import { ApiError } from "@/lib/api/client";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as typeof fetch;

function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }

beforeEach(() => fetchMock.mockReset());

describe("renter API", () => {
  it("reads profile through renter session path", async () => {
    fetchMock.mockResolvedValue(response({ id: "r", name: "An", phone: "8490", room: null, motel: { id: "m", name: "M" }, activeContract: null }));
    await getRenterMe();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/renter/me");
  });

  it("loads invoice, contract, and tickets from scoped paths", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(response([])));
    await listRenterPeriods();
    await listRenterInvoices("period");
    await getRenterContract("contract");
    await listRenterTickets();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/renter/billing/periods",
      "/api/renter/billing/periods/period/invoices",
      "/api/renter/contracts/contract",
      "/api/renter/tickets",
    ]);
  });

  it("sends OTP and ticket bodies without payment mutation", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(response({ otpSignedAt: null })));
    await requestRenterContractOtp("contract");
    await verifyRenterContractOtp("contract", "123456");
    await createRenterTicket({ category: "water", description: "Nước bị rò rỉ trong phòng" });
    expect(fetchMock.mock.calls.map(([, init]) => [init.method, init.body])).toEqual([
      ["POST", undefined],
      ["POST", JSON.stringify({ otp: "123456" })],
      ["POST", JSON.stringify({ category: "water", description: "Nước bị rò rỉ trong phòng" })],
    ]);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("paid"))).toBe(true);
  });

  it("exchanges magic link and preserves rate-limit details", async () => {
    fetchMock.mockResolvedValueOnce(response({ renterId: "r", motelId: "m" }));
    await exchangeRenterMagicLink("opaque");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/renter/magic-links/exchange");
    fetchMock.mockResolvedValue(response({ error: "Chờ thêm", code: "RATE_LIMITED", details: { retryAfterSeconds: 120 } }, 429));
    await expect(requestRenterContractOtp("contract")).rejects.toMatchObject({ code: "RATE_LIMITED", details: { retryAfterSeconds: 120 } } satisfies Partial<ApiError>);
  });
});
