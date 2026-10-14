import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createMagicLinkSession } from "@/lib/renter-magic-link";

afterEach(() => vi.unstubAllGlobals());
describe("renter magic link action", () => {
  it("gives the returned URL input the documented high-contrast control boundary", () => {
    const source = readFileSync(new URL("../../components/manager/renter-magic-link.tsx", import.meta.url), "utf8");
    const inputClasses = source.match(/<input\b[^>]*className="([^"]+)"/)?.[1]?.split(/\s+/);
    expect(inputClasses).toContain("border-border-strong");
    expect(inputClasses).not.toContain("border-border");
  });
  it("creates a bodyless same-origin POST and returns the exact portal URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ token: "opaque", url: "https://motel.example/r/opaque" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await createMagicLinkSession("motel", "renter").submit()).toEqual({ ok: true, url: "https://motel.example/r/opaque" });
    expect(fetchMock).toHaveBeenCalledWith("/api/manager/motels/motel/renters/renter/magic-link", expect.objectContaining({ method: "POST", credentials: "same-origin" }));
    expect(fetchMock.mock.calls[0]![1].body).toBeUndefined();
  });
  it("coalesces rapid requests then allows retry after completion", async () => {
    let release!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve; })).mockResolvedValue(Response.json({ token: "new", url: "https://motel.example/r/new" }));
    vi.stubGlobal("fetch", fetchMock);
    const session = createMagicLinkSession("motel", "renter");
    const first = session.submit();
    const second = session.submit();
    expect(release).toBeTypeOf("function");
    release(Response.json({ token: "opaque", url: "https://motel.example/r/opaque" }));
    expect(await first).toEqual({ ok: true, url: "https://motel.example/r/opaque" });
    expect(await second).toEqual(await first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await session.submit()).toEqual({ ok: true, url: "https://motel.example/r/new" });
  });
  it.each([[401, "UNAUTHORIZED", "Chưa đăng nhập"], [404, "NOT_FOUND", "Không tìm thấy khách thuê"], [429, "RATE_LIMITED", "Thử lại sau"]])("preserves actionable HTTP %i errors", async (status, code, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: message, code }, { status })));
    expect(await createMagicLinkSession("motel", "renter").submit()).toEqual({ ok: false, status, error: message });
  });
  it("hides server and transport internals", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "private driver", code: "INTERNAL_ERROR" }, { status: 500 })));
    expect(await createMagicLinkSession("motel", "renter").submit()).toEqual({ ok: false, status: 500, error: "Đã xảy ra lỗi hệ thống" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private host")));
    expect(await createMagicLinkSession("motel", "renter").submit()).toEqual({ ok: false, status: 0, error: "Đã xảy ra lỗi hệ thống" });
  });
});
