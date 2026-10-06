import { beforeEach, describe, expect, it, vi } from "vitest";
import ManagerLayout from "@/app/(manager)/layout";
import { MANAGER_ME, MOTEL } from "@/lib/api/__tests__/fixtures";

const env = vi.hoisted(() => ({ session: "valid" as string | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => env.session ? { value: env.session } : undefined, toString: () => env.session ? `manager_session=${env.session}` : "" }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); } }));
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => { env.session = "valid"; fetchMock.mockReset(); });

describe("manager layout session guard", () => {
  it("redirects an anonymous visitor before fetching any protected data", async () => {
    env.session = undefined;
    await expect(ManagerLayout({ children: "protected" })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["/api/auth/me", "/api/manager/motels"])("redirects when %s rejects the session", async (failedPath) => {
    fetchMock.mockImplementation((url: string) => Promise.resolve(url.endsWith(failedPath)
      ? new Response(JSON.stringify({ error: "Chưa đăng nhập", code: "UNAUTHORIZED" }), { status: 401 })
      : Response.json(url.endsWith("/api/auth/me") ? MANAGER_ME : [MOTEL])));
    await expect(ManagerLayout({ children: "protected" })).rejects.toThrow("NEXT_REDIRECT:/login");
  });
  it("loads the manager identity and owned motels using the forwarded session", async () => {
    fetchMock.mockImplementation((url: string) => Promise.resolve(Response.json(url.endsWith("/api/auth/me") ? MANAGER_ME : [MOTEL])));
    const result = await ManagerLayout({ children: "protected" });
    expect(result).toBeDefined();
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname).sort()).toEqual(["/api/auth/me", "/api/manager/motels"]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers((init as RequestInit).headers).get("cookie")).toBe("manager_session=valid");
      expect((init as RequestInit).cache).toBe("no-store");
    }
  });
});
