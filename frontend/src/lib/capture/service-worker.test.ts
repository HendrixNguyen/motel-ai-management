import { describe, expect, it, vi } from "vitest";

describe("capture service worker boundaries", () => {
  it("falls back only for capture navigation", async () => {
    const cache = { match: vi.fn(async (request: string) => request === "/capture/period/room" ? "cached-shell" : undefined), put: vi.fn() };
    const cachesApi = { open: vi.fn(async () => cache) };
    const fetcher = vi.fn(async (request: string) => { if (request.startsWith("/api/")) throw new Error("network"); throw new Error("offline"); });
    expect(cachesApi.open).toBeDefined(); expect(fetcher).toBeDefined();
    await expect(fetcher("/api/auth/me")).rejects.toThrow("network");
    await expect(cache.match("/capture/period/room")).resolves.toBe("cached-shell");
    expect(cache.put).not.toHaveBeenCalled();
  });
});
