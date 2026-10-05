import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { serverGet } from "@/lib/api/server";
import { MOTEL, MOTEL_ID, ROOM } from "./fixtures";

/**
 * The Server-Component transport. Three things separate it from `client.ts` and each has a test
 * below that fails if it is wrong:
 *
 * 1. It calls `${BACKEND_URL}${path}`, an **absolute** URL. A relative path is resolved by the
 *    browser against the app's own origin; `fetch` on the server has no origin, so the relative
 *    path is what silently works in development and throws in production.
 * 2. It forwards the `cookie` header. `manager_session` is `httpOnly`, so nothing in a Server
 *    Component can read it — only `cookies()` can, and only by handing it to the outgoing request.
 * 3. A 401 redirects instead of throwing. Every screen in the plan sits behind this call, so the
 *    one answer a manager cannot act on is "your session ended", and it is the same answer
 *    everywhere.
 *
 * The `vi.mock` preamble has to be duplicated in `endpoints.test.ts`: `vi.mock` is hoisted per
 * test file and a helper cannot register it for another module graph.
 */

/** Stand-in for Next's `redirect`, which throws a control-flow error rather than returning. */
const env = vi.hoisted(() => {
  const jar = { value: "" };
  const redirects: string[] = [];
  return { jar, redirects };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => env.jar.value }) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    env.redirects.push(path);
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

const GENERIC = "Đã xảy ra lỗi hệ thống";

const BACKEND_URL = "http://backend.internal:8080";
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestInit(): RequestInit {
  return fetchMock.mock.calls[0]![1] as RequestInit;
}

beforeEach(() => {
  fetchMock.mockReset();
  env.redirects.length = 0;
  env.jar.value = "manager_session=eyJhbGciOi.abc";
  process.env.BACKEND_URL = BACKEND_URL;
});

afterEach(() => {
  delete process.env.BACKEND_URL;
});

describe("serverGet", () => {
  it("calls the absolute backend URL, never the relative path the browser would resolve", async () => {
    fetchMock.mockResolvedValue(jsonResponse([MOTEL]));

    await serverGet(`/api/manager/motels`);

    const target = String(fetchMock.mock.calls[0]![0]);
    expect(target).toBe(`${BACKEND_URL}/api/manager/motels`);
    // A relative path is what a Server Component must not send: `fetch` has no origin to resolve
    // it against on the server, and a production build would fail where dev happened to work.
    expect(target.startsWith("/")).toBe(false);
  });

  it("reads BACKEND_URL per call, so it cannot disagree with the rewrite proxy at build time", async () => {
    process.env.BACKEND_URL = "http://elsewhere.test:9999";
    fetchMock.mockResolvedValue(jsonResponse([]));

    await serverGet("/api/manager/motels");

    expect(fetchMock.mock.calls[0]![0]).toBe("http://elsewhere.test:9999/api/manager/motels");
  });

  it("falls back to the same default next.config.ts uses when BACKEND_URL is unset", async () => {
    delete process.env.BACKEND_URL;
    fetchMock.mockResolvedValue(jsonResponse([]));

    await serverGet("/api/manager/motels");

    // `next.config.ts:10` defaults to `http://localhost:3000`. If the two defaults ever differ, a
    // fresh clone reads data through one host and mutates it through another.
    expect(fetchMock.mock.calls[0]![0]).toBe("http://localhost:3000/api/manager/motels");
  });

  it("forwards the session cookie, which only cookies() can read", async () => {
    fetchMock.mockResolvedValue(jsonResponse([ROOM]));

    await serverGet(`/api/manager/motels/${MOTEL_ID}/rooms`);

    expect(new Headers(requestInit().headers).get("cookie")).toBe("manager_session=eyJhbGciOi.abc");
    expect(new Headers(requestInit().headers).get("accept")).toBe("application/json");
  });

  it("sends no cookie header at all when the request carries none", async () => {
    env.jar.value = "";
    fetchMock.mockResolvedValue(jsonResponse([]));

    await serverGet("/api/manager/motels");

    // `cookie: ""` is not the same as no cookie to some servers, and it says something untrue about
    // the visitor.
    expect(new Headers(requestInit().headers).has("cookie")).toBe(false);
  });

  it("opts out of every cache, because the answer is this manager's", async () => {
    fetchMock.mockResolvedValue(jsonResponse([MOTEL]));

    await serverGet("/api/manager/motels");

    // No `revalidate`, no `tags`, no store: a cached motel list is one manager's data served to
    // another. `no-store` is also the whole reason this layer needs no cache policy of its own.
    expect(requestInit().cache).toBe("no-store");
  });

  it("redirects to /login on a 401 instead of throwing", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Chưa đăng nhập", code: "UNAUTHORIZED" }, 401));

    await expect(serverGet("/api/auth/me")).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(env.redirects).toEqual(["/login"]);
  });

  it("redirects on a 401 even when the body is not our envelope", async () => {
    // A 401 from the proxy in front of the app means the same thing as a 401 from the backend: no
    // session. Keying the redirect on the status alone means it cannot be missed.
    fetchMock.mockResolvedValue(new Response("Unauthorized", { status: 401 }));

    await expect(serverGet("/api/auth/me")).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("throws an ApiError, not a redirect, for every other failure", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Không tìm thấy", code: "NOT_FOUND" }, 404));

    const error = (await serverGet(`/api/manager/motels/${MOTEL_ID}/rooms/x`).catch(
      (cause: unknown) => cause,
    )) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Không tìm thấy");
    expect(env.redirects).toEqual([]);
  });

  it("does not leak a 5xx either", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "connect ECONNREFUSED postgres://motel:hunter2@db:5432", code: "INTERNAL_ERROR" }, 500),
    );

    const error = (await serverGet("/api/manager/motels").catch(
      (cause: unknown) => cause,
    )) as ApiError;

    expect(error.message).toBe(GENERIC);
    expect(error.message).not.toContain("hunter2");
  });

  it("reports an unreachable backend as status 0, not as a thrown TypeError", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const error = (await serverGet("/api/manager/motels").catch(
      (cause: unknown) => cause,
    )) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(env.redirects).toEqual([]);
  });

  it("applies the same money guard the browser path applies", async () => {
    // The manager screens are Server Components, so this path is the one that renders money. A
    // guard that lived only in `client.ts` would leave every screen unguarded.
    const broken = { ...MOTEL, electricityPrice: "3.500,00" };
    fetchMock.mockResolvedValue(jsonResponse(broken));

    await expect(serverGet("/api/manager/motels")).rejects.toThrow(/electricityPrice/);
  });

  it("returns a decoded body with the guard's normalisation applied", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...MOTEL, waterPrice: "15.000" }));

    const motel = await serverGet<typeof MOTEL>("/api/manager/motels");

    expect(motel.waterPrice).toBe("15000");
  });

  it("rejects a path that is not site-relative before it reaches fetch", async () => {
    await expect(serverGet(`${BACKEND_URL}/api/manager/motels`)).rejects.toThrow(/site-relative/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
