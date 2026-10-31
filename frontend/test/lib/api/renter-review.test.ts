import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRenterInvoice,
  createRenterTicket,
  exchangeRenterMagicLink,
  getRenterPaymentProof,
  submitRenterPaymentProof,
} from "@/lib/api/renter";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as typeof fetch;
const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
beforeEach(() => fetchMock.mockReset());

describe("renter review APIs", () => {
  it("exchanges token at /api/renter/magic-links/exchange", async () => {
    fetchMock.mockResolvedValue(response({ renterId: "r", motelId: "m" }));
    await exchangeRenterMagicLink("token");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/renter/magic-links/exchange");
  });
  it("loads invoice detail endpoint", async () => {
    fetchMock.mockResolvedValue(response({ id: "invoice", bankAccount: null, meterPhotos: [] }));
    await getRenterInvoice("invoice");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/renter/invoices/invoice");
  });
  it("encodes invoice path and submits one payment proof as multipart", async () => {
    fetchMock.mockResolvedValue(response(null));
    await getRenterPaymentProof("invoice/one");
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
      "/api/renter/invoices/invoice%2Fone/payment-proof",
    );
    const file = new File(["proof"], "proof.png", { type: "image/png" });
    fetchMock.mockResolvedValue(response({ id: "proof" }));
    await submitRenterPaymentProof("invoice/one", file);
    const [path, init] = fetchMock.mock.calls.at(-1)!;
    expect(path).toBe("/api/renter/invoices/invoice%2Fone/payment-proof");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ accept: "application/json" });
    expect((init.body as FormData).get("file")).toBe(file);
  });
  it("sends tickets as multipart when photos exist", async () => {
    fetchMock.mockResolvedValue(response({ id: "ticket" }));
    const photo = new File(["jpeg"], "meter.jpg", { type: "image/jpeg" });
    await createRenterTicket({
      category: "water",
      description: "Nước bị rò rỉ trong phòng",
      photos: [photo],
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({ accept: "application/json" });
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeInstanceOf(FormData);
  });
});
