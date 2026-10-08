import { expect, it, vi } from "vitest";
import { logoutRenter, getRenterInvoice } from "@/lib/api/renter";
const fetchMock = vi.fn(); globalThis.fetch = fetchMock as typeof fetch;
const response = (body: unknown, status = 200) => new Response(status === 204 ? null : body === undefined ? "" : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
it("uses renter logout endpoint", async () => { fetchMock.mockResolvedValue(response(undefined, 204)); await logoutRenter(); expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/renter/logout"); expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST"); });
it("uses invoice detail endpoint", async () => { fetchMock.mockReset(); fetchMock.mockResolvedValue(response({ id: "i" })); await getRenterInvoice("i"); expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/renter/invoices/i"); });
