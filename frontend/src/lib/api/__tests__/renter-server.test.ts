import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverGetRenter } from "@/lib/api/renter.server";
const fetchMock = vi.fn(); globalThis.fetch = fetchMock as typeof fetch;
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "renter_session=fixture" }) }));
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
beforeEach(() => { fetchMock.mockReset(); process.env.BACKEND_URL = "http://backend.test"; });
describe("renter server transport", () => { it("forwards renter cookie and uses absolute backend URL", async () => { fetchMock.mockResolvedValue(response({ id: "r" })); await serverGetRenter("/api/renter/me"); expect(fetchMock.mock.calls[0]).toEqual(["http://backend.test/api/renter/me", expect.objectContaining({ cache: "no-store", headers: { accept: "application/json", cookie: "renter_session=fixture" } })]); }); });
