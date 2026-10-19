import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { cookies } from "next/headers";
import { serverGetRenter } from "@/lib/api/renter.server";
const fetchMock = vi.fn(); globalThis.fetch = fetchMock as typeof fetch;
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ toString: (): string => "renter_session=fixture" })) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); }) }));
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
beforeEach(() => { fetchMock.mockReset(); vi.mocked(cookies).mockResolvedValue({ toString: (): string => "renter_session=fixture" } as never); process.env.BACKEND_URL = "http://backend.test"; });
describe("renter server transport", () => {
  it("forwards renter cookie and uses absolute backend URL", async () => { fetchMock.mockResolvedValue(response({ id: "r" })); await serverGetRenter("/api/renter/me"); expect(fetchMock.mock.calls[0]).toEqual(["http://backend.test/api/renter/me", expect.objectContaining({ cache: "no-store", headers: { accept: "application/json", cookie: "renter_session=fixture" } })]); });
  it("omits empty cookie, uses fallback backend URL and passes decoded error", async () => {
    vi.mocked(cookies).mockResolvedValueOnce({ toString: (): string => "" } as never);
    delete process.env.BACKEND_URL;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "No", code: "NOT_FOUND" }), { status: 404, headers: { "content-type": "application/json" } }));
    await expect(serverGetRenter("/api/renter/missing")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("http://localhost:3000/api/renter/missing");
    expect(fetchMock.mock.calls.at(-1)?.[1]?.headers).toEqual({ accept: "application/json" });
  });
  it("redirects 401 and wraps network error with generic safe message", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    await expect(serverGetRenter("/api/renter/me")).rejects.toThrow("NEXT_REDIRECT:/renter");
    fetchMock.mockRejectedValueOnce(new Error("secret database host"));
    const error = await serverGetRenter("/api/renter/me").catch((cause) => cause);
    expect(error).toMatchObject({ status: 0, code: "INTERNAL_ERROR", message: expect.not.stringContaining("secret database host") });
  });
  it("rejects unsafe path before network access", async () => {
    await expect(serverGetRenter("https://evil.test/steal")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
