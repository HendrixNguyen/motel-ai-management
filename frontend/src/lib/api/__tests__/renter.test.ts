import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRenterMe, listRenterPeriods, listRenterInvoices, getRenterContract, acceptRenterContractConsent, listRenterTickets, createRenterTicket, exchangeRenterMagicLink, getRenterPushKey, getRenterPushSubscription, saveRenterPushSubscription, removeRenterPushSubscription, getRenterInvoice, getRenterPaymentProof, submitRenterPaymentProof } from "@/lib/api/renter";
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

  it("loads one renter ticket by scoped id", async () => {
    fetchMock.mockResolvedValue(response({ id: "ticket", description: "Nước rò rỉ" }));
    const { getRenterTicket } = await import("@/lib/api/renter");
    await getRenterTicket("ticket");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/renter/tickets/ticket");
  });

  it("encodes renter invoice and proof ids and uploads exactly one multipart file", async () => {
    fetchMock.mockResolvedValueOnce(response({ id: "invoice" }));
    await getRenterInvoice("inv/one");
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/renter/invoices/inv%2Fone");
    fetchMock.mockResolvedValueOnce(response(null));
    await getRenterPaymentProof("inv/one");
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/renter/invoices/inv%2Fone/payment-proof");
    const file = new File(["proof"], "proof.png", { type: "image/png" });
    fetchMock.mockResolvedValueOnce(response({ id: "proof" }, 201));
    await submitRenterPaymentProof("inv/one", file);
    const [path, init] = fetchMock.mock.calls.at(-1)!;
    expect(path).toBe("/api/renter/invoices/inv%2Fone/payment-proof");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ accept: "application/json" });
    expect((init.body as FormData).get("file")).toBe(file);
  });

  it("records explicit consent and sends ticket without payment mutation", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(response({ status: "active", consentMethod: "session_consent" })));
    await acceptRenterContractConsent("contract", "a".repeat(64));
    await createRenterTicket({ category: "water", description: "Nước bị rò rỉ trong phòng" });
    expect(fetchMock.mock.calls.map(([, init]) => [init.method, init.body])).toEqual([
      ["POST", JSON.stringify({ consent: true, termsVersion: "a".repeat(64) })],
      ["POST", JSON.stringify({ category: "water", description: "Nước bị rò rỉ trong phòng" })],
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/renter/contracts/contract/consent");
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("paid"))).toBe(true);
  });

  it("keeps push subscription management inside renter-scoped same-origin APIs", async () => {
    fetchMock.mockResolvedValueOnce(response({ publicKey: "public", enabled: true }));
    fetchMock.mockResolvedValueOnce(response({ subscription: null }));
    fetchMock.mockResolvedValueOnce(response({ registered: true, subscriptionId: "subscription" }));
    fetchMock.mockResolvedValueOnce(response({ removed: true }));
    await getRenterPushKey();
    await getRenterPushSubscription();
    await saveRenterPushSubscription({ endpoint: "https://fcm.googleapis.com/push/one", keys: { p256dh: "p256dh", auth: "auth" } } as PushSubscriptionJSON);
    await removeRenterPushSubscription("https://fcm.googleapis.com/push/one");
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ["/api/renter/push/key", "GET"],
      ["/api/renter/push/subscription", "GET"],
      ["/api/renter/push/subscription", "POST"],
      ["/api/renter/push/subscription", "DELETE"],
    ]);
  });

  it("exchanges magic link and preserves rate-limit details", async () => {
    fetchMock.mockResolvedValueOnce(response({ renterId: "r", motelId: "m" }));
    await exchangeRenterMagicLink("opaque");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/renter/magic-links/exchange");
    fetchMock.mockResolvedValue(response({ error: "Liên kết hết hạn", code: "RENTER_SESSION_INVALID" }, 401));
    await expect(acceptRenterContractConsent("contract", "a".repeat(64))).rejects.toMatchObject({ status: 401 } satisfies Partial<ApiError>);
  });
});
