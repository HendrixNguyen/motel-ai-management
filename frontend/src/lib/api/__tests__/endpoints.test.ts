import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMe } from "@/lib/api/auth";
import {
  createMotel,
  deleteMotel,
  updateMotel,
} from "@/lib/api/motels.client";
import { getMotel, listMotels } from "@/lib/api/motels";
import { createRoom, deleteRoom, updateRoom } from "@/lib/api/rooms.client";
import { getRoom, listRooms } from "@/lib/api/rooms";
import { createRenter, createRenterMagicLink, deleteRenter, updateRenter } from "@/lib/api/renters.client";
import { getRenter, listRenters } from "@/lib/api/renters";
import { login, logout, register } from "@/lib/api/auth.client";
import {
  MANAGER_AUTH,
  MANAGER_ME,
  MOTEL,
  MOTEL_ID,
  RENTERS,
  RENTER_DETAIL,
  RENTER_ID,
  ROOMS,
  ROOM,
  ROOM_ID,
} from "./fixtures";

/**
 * One function per endpoint, and the URL lives here rather than in a screen.
 *
 * Two invariants this file pins, both of which a later task can break silently:
 *
 * - **The split by transport is real.** `motels.ts` and friends speak to the backend absolutely
 *   because they run in a Server Component; `motels.client.ts` and friends speak to `/api/...`
 *   relatively because they run in the browser under D3 ("mutations are client components POSTing
 *   to the proxied path"). Each assertion below checks which of the two a given function used, so
 *   a write that quietly became a server call — or a read that became a browser call — fails here
 *   rather than at runtime with a `cookies()` error or a same-origin 404.
 * - **A list endpoint answers with a bare array.** `docs/api-contract.md` is silent on envelopes;
 *   `listMotels`/`listRooms`/`listRenters` return the array itself
 *   (`motel.service.ts:45`, `room.service.ts:126`, `renter.service.ts:172`), and a screen written
 *   against `{ motels: [...] }` would find nothing at runtime with no type error to catch it.
 */

const env = vi.hoisted(() => {
  const jar = { value: "manager_session=eyJhbGciOi.abc" };
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

const BACKEND_URL = "http://backend.internal:8080";
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function lastUrl(): string {
  return String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]![0]);
}

function lastInit(): RequestInit {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1]![1] as RequestInit;
}

/** Every request either module makes, as `"METHOD <url>"`. */
function calls(): string[] {
  return fetchMock.mock.calls.map(
    (call) => `${(call[1] as RequestInit).method} ${String(call[0])}`,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  env.redirects.length = 0;
  process.env.BACKEND_URL = BACKEND_URL;
});

afterEach(() => {
  delete process.env.BACKEND_URL;
});

describe("reads (Server Components, absolute URL)", () => {
  it("lists every motel of the signed-in manager", async () => {
    fetchMock.mockResolvedValue(jsonResponse([MOTEL]));

    await expect(listMotels()).resolves.toEqual([MOTEL]);

    expect(lastUrl()).toBe(`${BACKEND_URL}/api/manager/motels`);
    expect(lastInit().method).toBe("GET");
  });

  it("reads one motel", async () => {
    fetchMock.mockResolvedValue(jsonResponse(MOTEL));

    await expect(getMotel(MOTEL_ID)).resolves.toEqual(MOTEL);

    expect(lastUrl()).toBe(`${BACKEND_URL}/api/manager/motels/${MOTEL_ID}`);
  });

  it("lists a motel's rooms with no query string when there are no filters", async () => {
    fetchMock.mockResolvedValue(jsonResponse(ROOMS));

    await expect(listRooms(MOTEL_ID)).resolves.toEqual(ROOMS);

    expect(lastUrl()).toBe(`${BACKEND_URL}/api/manager/motels/${MOTEL_ID}/rooms`);
  });

  it("encodes every room filter the backend reads", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await listRooms(MOTEL_ID, { floor: 3, status: "occupied", search: "P.10" });

    // `room.route.ts:53-57` reads exactly `floor`, `status` and `search`. A name the backend does
    // not read is dropped there silently, so the frontend spelling has to match or the filter
    // narrows nothing and the screen reads "no rooms match".
    const url = new URL(lastUrl());
    expect(url.pathname).toBe(`/api/manager/motels/${MOTEL_ID}/rooms`);
    expect([...url.searchParams.entries()].sort()).toEqual([
      ["floor", "3"],
      ["search", "P.10"],
      ["status", "occupied"],
    ]);
  });

  it("sends floor 0 rather than dropping it as falsy", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await listRooms(MOTEL_ID, { floor: 0 });

    // `floor: 0` is a real value: `room.service.ts:114` filters on `!== undefined`, and a truthiness
    // test here would send no filter at all and answer with every floor.
    expect(new URL(lastUrl()).searchParams.get("floor")).toBe("0");
  });

  it("omits an empty search instead of sending a filter that matches nothing", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await listRooms(MOTEL_ID, { search: "" });

    // `room.service.ts:117-119` deliberately treats an empty `?search=` as no filter, so sending one
    // is noise; a manager who cleared the box asked for the whole list.
    expect(new URL(lastUrl()).search).toBe("");
  });

  it("reads one room", async () => {
    fetchMock.mockResolvedValue(jsonResponse(ROOM));

    await expect(getRoom(MOTEL_ID, ROOM_ID)).resolves.toEqual(ROOM);

    expect(lastUrl()).toBe(`${BACKEND_URL}/api/manager/motels/${MOTEL_ID}/rooms/${ROOM_ID}`);
  });

  it("percent-encodes a Vietnamese search term", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await listRenters(MOTEL_ID, { search: "Nguyễn Thị Ánh" });

    // `URLSearchParams` encodes UTF-8; a hand-built `?search=${term}` would send a raw string that
    // some proxies mangle, and a renter's name is the one field guaranteed to be accented.
    expect(lastUrl()).toBe(
      `${BACKEND_URL}/api/manager/motels/${MOTEL_ID}/renters?search=Nguy%E1%BB%85n+Th%E1%BB%8B+%C3%81nh`,
    );
    expect(new URL(lastUrl()).searchParams.get("search")).toBe("Nguyễn Thị Ánh");
  });

  it("lists a motel's renters as a bare JSON array", async () => {
    fetchMock.mockResolvedValue(jsonResponse(RENTERS));

    await expect(listRenters(MOTEL_ID)).resolves.toEqual(RENTERS);

    expect(lastUrl()).toBe(`${BACKEND_URL}/api/manager/motels/${MOTEL_ID}/renters`);
  });

  it("encodes every renter filter", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await listRenters(MOTEL_ID, { status: "active", roomId: ROOM_ID, search: "Trần" });

    const url = new URL(lastUrl());
    expect(url.pathname).toBe(`/api/manager/motels/${MOTEL_ID}/renters`);
    expect([...url.searchParams.entries()].sort()).toEqual([
      ["roomId", ROOM_ID],
      ["search", "Trần"],
      ["status", "active"],
    ]);
  });

  it("reads the renter detail view, with the contract and the invoices", async () => {
    fetchMock.mockResolvedValue(jsonResponse(RENTER_DETAIL));

    await expect(getRenter(MOTEL_ID, RENTER_ID)).resolves.toEqual(RENTER_DETAIL);

    expect(lastUrl()).toBe(`${BACKEND_URL}/api/manager/motels/${MOTEL_ID}/renters/${RENTER_ID}`);
  });

  it("answers the signed-in manager's own identity", async () => {
    fetchMock.mockResolvedValue(jsonResponse(MANAGER_ME));

    await expect(getMe()).resolves.toEqual(MANAGER_ME);

    expect(lastUrl()).toBe(`${BACKEND_URL}/api/auth/me`);
  });

  it("redirects to /login rather than rendering a shell for an ended session", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Chưa đăng nhập", code: "UNAUTHORIZED" }, 401));

    await expect(getMe()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});

describe("writes (client components, relative URL through the proxy)", () => {
  it("creates a motel", async () => {
    fetchMock.mockResolvedValue(jsonResponse(MOTEL, 201));

    await createMotel({
      name: MOTEL.name,
      address: MOTEL.address,
      electricityPrice: "3500",
      waterPrice: "15000",
    });

    expect(lastUrl()).toBe("/api/manager/motels");
    expect(lastInit().method).toBe("POST");
    expect(JSON.parse(String(lastInit().body))).toMatchObject({ electricityPrice: "3500" });
  });

  it("patches a motel with only the keys the manager changed", async () => {
    fetchMock.mockResolvedValue(jsonResponse(MOTEL));

    await updateMotel(MOTEL_ID, { waterPrice: "16000" });

    expect(lastUrl()).toBe(`/api/manager/motels/${MOTEL_ID}`);
    expect(lastInit().method).toBe("PATCH");
    // `motel.route.ts:79-86` treats every key optional and writes only what arrived, so sending a
    // `null` for an untouched field would clear a value the manager never edited.
    expect(JSON.parse(String(lastInit().body))).toEqual({ waterPrice: "16000" });
  });

  it("deletes a motel and resolves undefined on the 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteMotel(MOTEL_ID)).resolves.toBeUndefined();

    expect(lastUrl()).toBe(`/api/manager/motels/${MOTEL_ID}`);
    expect(lastInit().method).toBe("DELETE");
  });

  it("creates, patches and deletes a room", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(ROOM, 201));
    await createRoom(MOTEL_ID, { name: "P.101", basePrice: "3500000", floor: 1 });
    expect(lastUrl()).toBe(`/api/manager/motels/${MOTEL_ID}/rooms`);
    expect(lastInit().method).toBe("POST");

    fetchMock.mockResolvedValueOnce(jsonResponse(ROOM));
    await updateRoom(MOTEL_ID, ROOM_ID, { status: "maintenance" });
    expect(lastUrl()).toBe(`/api/manager/motels/${MOTEL_ID}/rooms/${ROOM_ID}`);
    expect(lastInit().method).toBe("PATCH");

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteRoom(MOTEL_ID, ROOM_ID)).resolves.toBeUndefined();
    expect(lastInit().method).toBe("DELETE");
  });

  it("creates, patches and deletes a renter", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(RENTER_DETAIL, 201));
    await createRenter(MOTEL_ID, { name: "Trần Thị B", phone: "0901234567" });
    expect(lastUrl()).toBe(`/api/manager/motels/${MOTEL_ID}/renters`);
    expect(lastInit().method).toBe("POST");

    fetchMock.mockResolvedValueOnce(jsonResponse(RENTER_DETAIL));
    await updateRenter(MOTEL_ID, RENTER_ID, { roomId: ROOM_ID });
    expect(lastUrl()).toBe(`/api/manager/motels/${MOTEL_ID}/renters/${RENTER_ID}`);
    expect(lastInit().method).toBe("PATCH");

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteRenter(MOTEL_ID, RENTER_ID)).resolves.toBeUndefined();
    expect(lastInit().method).toBe("DELETE");
  });

  it("creates a magic link for a renter", async () => {
    const fixture = { token: "abc123", url: "http://localhost:3000/r/abc123" };
    fetchMock.mockResolvedValue(jsonResponse(fixture));

    await expect(createRenterMagicLink(MOTEL_ID, RENTER_ID)).resolves.toEqual(fixture);

    expect(lastUrl()).toBe(`/api/manager/motels/${MOTEL_ID}/renters/${RENTER_ID}/magic-link`);
    expect(lastInit().method).toBe("POST");
  });

  it("logs in through the proxied path so the browser stores the httpOnly cookie itself", async () => {
    // A Server Action could not do this: the backend's `Set-Cookie` would have to be forwarded by
    // hand, and a missed attribute is an insecure cookie. A relative browser POST is the only path
    // on which the cookie is set exactly as `auth.route.ts:48-55` describes it.
    fetchMock.mockResolvedValue(jsonResponse(MANAGER_AUTH));

    await expect(login({ email: "minhanh@example.vn", password: "correct horse" })).resolves.toEqual(
      MANAGER_AUTH,
    );

    expect(lastUrl()).toBe("/api/auth/login");
    expect(lastInit().method).toBe("POST");
    expect(lastInit().credentials).toBe("same-origin");
  });

  it("registers, and tells the two auth answers apart", async () => {
    fetchMock.mockResolvedValue(jsonResponse(MANAGER_AUTH, 201));

    const registered = await register({
      email: "minhanh@example.vn",
      password: "correct horse",
      name: "Nguyễn Minh Anh",
    });

    expect(lastUrl()).toBe("/api/auth/register");
    expect(registered).toEqual(MANAGER_AUTH);
    // `getMe()` answers `{ id, email }`; a screen that reads `name` off it gets `undefined`. The
    // two are separate types because the two answers are separate objects.
    expect(Object.keys(registered)).toContain("name");
    expect(Object.keys(MANAGER_ME)).not.toContain("name");
  });

  it("logs out and resolves undefined on the 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(logout()).resolves.toBeUndefined();

    expect(lastUrl()).toBe("/api/auth/logout");
    expect(lastInit().method).toBe("POST");
    expect(lastInit().body).toBeUndefined();
  });

  it("surfaces a rejected login as an ApiError the form can render", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "Email hoặc mật khẩu không đúng", code: "VALIDATION_ERROR" }, 400),
    );

    const error = (await login({ email: "minhanh@example.vn", password: "wrong" }).catch(
      (cause: unknown) => cause,
    )) as Error;

    expect(error.message).toBe("Email hoặc mật khẩu không đúng");
  });
});

describe("URL ownership", () => {
  it("sends a read absolute and a write relative, and neither crosses the other", async () => {
    // A factory, not one resolved `Response`: a body can only be read once, and this case makes two
    // calls.
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([MOTEL])));

    await listMotels();
    await deleteRenter(MOTEL_ID, RENTER_ID);

    // D3: reads run in Server Components, so they need an absolute URL the server can resolve;
    // writes run in the browser, so they need the relative path the rewrite proxy forwards. Getting
    // either backwards is a runtime failure at best — a same-origin 404, or `fetch` with no origin.
    expect(calls()).toEqual([
      `GET ${BACKEND_URL}/api/manager/motels`,
      `DELETE /api/manager/motels/${MOTEL_ID}/renters/${RENTER_ID}`,
    ]);
  });

  it("sends only /api paths, so no module can address the backend directly", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([MOTEL])));

    await listMotels();
    await logout();

    for (const url of fetchMock.mock.calls.map((call) => String(call[0]))) {
      expect(url.startsWith("/api/") || url.startsWith(`${BACKEND_URL}/api/`)).toBe(true);
    }
  });
});
