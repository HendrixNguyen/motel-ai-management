import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiGet, apiSend } from "@/lib/api/client";
import type { MotelResponse } from "@/lib/api/types";
import { MOTEL, MOTEL_ID, ROOM, RENTER_DETAIL } from "./fixtures";

/**
 * The browser transport. No network and no backend: `fetch` is stubbed, so every case here is the
 * transport's own behaviour on a response body it was handed.
 *
 * The rule this file exists to hold: **the client never renders something the wire did not promise.**
 * A 4xx message is the backend's own Vietnamese text and safe to show; a 5xx message is not, and is
 * replaced here rather than trusted — `error-handler.ts:28-33` already collapses an unexpected fault
 * to a generic line server-side, and a second collapse on this side means a fault in *anything*
 * between (the rewrite proxy, a load balancer, a future gateway) cannot put a database URL on screen
 * either.
 */

/** The Vietnamese line the backend substitutes for any unexpected fault (`error-handler.ts:31`). */
const GENERIC = "Đã xảy ra lỗi hệ thống";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A body that is not our envelope at all — a reverse proxy's HTML error page, in the wild. */
function htmlResponse(status: number, text: string): Response {
  return new Response(text, { status, headers: { "content-type": "text/html" } });
}

function withField(fixture: unknown, path: Array<string | number>, value: unknown): unknown {
  const clone = structuredClone(fixture) as Record<string | number, unknown>;
  let node = clone;
  for (const step of path.slice(0, -1)) {
    node = node[step] as Record<string | number, unknown>;
  }
  node[path[path.length - 1] as string | number] = value;
  return clone;
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("apiGet", () => {
  it("calls the site-relative path, so the httpOnly session cookie travels with it", async () => {
    fetchMock.mockResolvedValue(jsonResponse(MOTEL));

    await apiGet<MotelResponse[]>("/api/manager/motels");

    // The browser is given no base URL at all: `next.config.ts` rewrites `/api/:path*` onto the
    // backend, which is the only reason a `host-only` cookie can reach it (ADR-0008).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/manager/motels");
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("same-origin");
    expect(new Headers(init.headers).get("accept")).toBe("application/json");
  });

  it("returns the decoded body", async () => {
    fetchMock.mockResolvedValue(jsonResponse([ROOM]));

    await expect(apiGet("/api/manager/motels/x/rooms")).resolves.toEqual([ROOM]);
  });
});

describe("apiSend", () => {
  it("sends the method and a JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(ROOM, 201));

    await apiSend("/api/manager/motels/x/rooms", "POST", { name: "P.102", basePrice: "3500000" });

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"name":"P.102","basePrice":"3500000"}');
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("sends no body and no content-type for a DELETE that takes none", async () => {
    // `room.route.ts:130-140` deletes on the path alone; a `content-type` with no body, or a
    // literal `"undefined"`, is the kind of thing that turns into a 400 on someone else's server.
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiSend("/api/manager/motels/x/rooms/y", "DELETE")).resolves.toBeUndefined();

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get("content-type")).toBeNull();
  });

  it("returns undefined for an empty 204 body", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiSend("/api/auth/logout", "POST")).resolves.toBeUndefined();
  });
});

describe("paths", () => {
  it.each([
    ["an absolute URL", "http://localhost:3000/api/manager/motels"],
    ["a protocol-relative URL", "//evil.example/api/manager/motels"],
    ["a bare path with no leading slash", "api/manager/motels"],
  ])("rejects %s, which would cross the origin the cookie cannot cross", async (_name, path) => {
    await expect(apiGet(path)).rejects.toThrow(/site-relative/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ApiError", () => {
  it("carries the envelope's code, not one derived from the status", async () => {
    // Both are 401, so an implementation that mapped status → code would answer `UNAUTHORIZED` and
    // a screen could not tell an expired magic link from a missing session. The code is the stable
    // identifier (`shared/errors.ts:1-14`); the status is only how the server chose to send it.
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "Liên kết đã hết hạn", code: "MAGIC_LINK_EXPIRED" }, 401),
    );

    const error = await apiGet("/api/renter/me").catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.code).toBe("MAGIC_LINK_EXPIRED");
    expect(apiError.status).toBe(401);
  });

  it("carries the Vietnamese message of a 4xx, which was written for the renter to read", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'Số điện thoại "84901234567" đã tồn tại trong nhà trọ này', code: "CONFLICT" },
        409,
      ),
    );

    const error = (await apiGet("/api/x").catch((cause: unknown) => cause)) as ApiError;

    expect(error.code).toBe("CONFLICT");
    expect(error.message).toBe('Số điện thoại "84901234567" đã tồn tại trong nhà trọ này');
  });

  it("does not leak a driver message from a 5xx envelope", async () => {
    // The envelope's `error` field is trusted for 4xx and discarded for 5xx. If anything ever
    // reaches this client with an uncaught driver fault inside `error`, this is the line that
    // stops it from reaching a screen.
    const leak =
      "connect ECONNREFUSED 10.0.0.5:5432 — password authentication failed for user motel";
    fetchMock.mockResolvedValue(jsonResponse({ error: leak, code: "INTERNAL_ERROR" }, 500));

    const error = (await apiGet("/api/manager/motels").catch((cause: unknown) => cause)) as ApiError;

    expect(error.message).toBe(GENERIC);
    expect(error.message).not.toContain("ECONNREFUSED");
    expect(error.message).not.toContain("10.0.0.5");
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.status).toBe(500);
  });

  it("does not leak an internal URL from a 5xx body that is not the envelope", async () => {
    // Anything between here and the backend can answer instead of the backend: the rewrite proxy,
    // a load balancer, a CDN. A 502 HTML page naming the backend's internal address must not
    // become an error message either.
    fetchMock.mockResolvedValue(
      htmlResponse(
        502,
        "<html><body>502 Bad Gateway: upstream http://10.0.0.7:3000/api is unreachable</body></html>",
      ),
    );

    const error = (await apiGet("/api/manager/motels").catch((cause: unknown) => cause)) as ApiError;

    expect(error.message).toBe(GENERIC);
    expect(error.message).not.toContain("10.0.0.7");
    expect(error.code).toBe("INTERNAL_ERROR");
  });

  it("keeps the code of a 5xx the backend did classify, while still hiding its message", async () => {
    // `EXTERNAL_SERVICE_ERROR` is a 502 the Zalo or R2 call produced. The code is safe and tells a
    // manager-facing screen what happened; the message is replaced.
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "Zalo từ chối: token hết hạn", code: "EXTERNAL_SERVICE_ERROR" }, 502),
    );

    const error = (await apiGet("/api/manager/motels/x/notifications").catch(
      (cause: unknown) => cause,
    )) as ApiError;

    expect(error.code).toBe("EXTERNAL_SERVICE_ERROR");
    expect(error.message).toBe(GENERIC);
  });

  it("does not render the message of a body whose code the contract does not have", async () => {
    // Both keys look right and the code is not ours, so this is not an envelope this app wrote.
    // Trusting its `error` would put an arbitrary string from whatever answered into a Vietnamese
    // form; the status still carries the answer.
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: "proxy: upstream connect ECONNREFUSED 10.0.0.9:3000 (nginx/1.24)", code: "BAD_GATEWAY" },
        502,
      ),
    );

    const error = (await apiGet("/api/manager/motels").catch((cause: unknown) => cause)) as ApiError;

    expect(error.message).toBe(GENERIC);
    expect(error.message).not.toContain("10.0.0.9");
    expect(error.code).toBe("INTERNAL_ERROR");
  });

  it("derives a code from the status when the body is not the envelope", async () => {
    // A 404 from the proxy in front of the app is not our `NOT_FOUND` envelope, but the status is
    // still true and a screen can still route on it.
    fetchMock.mockResolvedValue(htmlResponse(404, "Not Found"));

    const error = (await apiGet("/api/manager/motels/x/rooms/y").catch(
      (cause: unknown) => cause,
    )) as ApiError;

    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.message).toBe(GENERIC);
  });

  it("reports a request that never reached the server as status 0 and nothing else", async () => {
    // `fetch` rejects with a `TypeError` whose `cause` can hold the host and port it tried. That
    // must not become a message; status 0 is this layer's way of saying "no response arrived".
    fetchMock.mockRejectedValue(
      new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED 127.0.0.1:3000") }),
    );

    const error = (await apiGet("/api/manager/motels").catch((cause: unknown) => cause)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).toBe(GENERIC);
  });
});

describe("the money guard", () => {
  it("normalises grouped digits to the bare digits the wire format uses", async () => {
    // The backend stores `numeric` and postgres.js hands back bare digits, so a grouped value means
    // something changed. Normalising rather than rejecting keeps a correct amount correct, and the
    // round trip through `formatVndPlain` still holds for an editable field.
    const grouped = withField(MOTEL, ["electricityPrice"], "3.500");
    fetchMock.mockResolvedValue(jsonResponse(grouped));

    const motel = await apiGet<MotelResponse>("/api/manager/motels");

    expect(motel.electricityPrice).toBe("3500");
  });

  it.each([
    ["MotelResponse.electricityPrice", ["MOTEL", "electricityPrice"], "1.5"],
    ["MotelResponse.waterPrice", ["MOTEL", "waterPrice"], "15 000"],
    ["MotelResponse.electricityPrice", ["MOTEL", "electricityPrice"], "abc"],
    ["MotelResponse.electricityPrice", ["MOTEL", "electricityPrice"], ""],
    ["MotelResponse.electricityPrice", ["MOTEL", "electricityPrice"], "-3500"],
    ["MotelFeeInput.amount", ["MOTEL", "otherFees", 1, "amount"], "1.500.00"],
    ["RoomResponse.basePrice", ["ROOM", "basePrice"], "3500000₫"],
    [
      "ActiveContractSummary.monthlyRent",
      ["RENTER_DETAIL", "activeContract", "monthlyRent"],
      "3.50.000",
    ],
    ["RecentInvoice.totalAmount", ["RENTER_DETAIL", "invoices", 0, "totalAmount"], "3740000,00"],
  ])("refuses %s = %j rather than let a wrong amount reach a screen", async (_name, path, value) => {
    const fixture = path[0] === "ROOM" ? ROOM : path[0] === "RENTER_DETAIL" ? RENTER_DETAIL : MOTEL;
    fetchMock.mockResolvedValue(jsonResponse(withField(fixture, path.slice(1), value)));

    await expect(apiGet("/api/manager/motels")).rejects.toThrow(/electricityPrice|waterPrice|amount|basePrice|monthlyRent|totalAmount/);
  });

  it.each([
    ["a JSON number", 3500000],
    ["null", null],
    ["an object", { value: "3500000" }],
  ])("refuses a money field that arrived as %s, because a float is what the guard exists for", async (_name, value) => {
    // `VndString` is `string`, so the compiler catches this in a fixture — but the *response* is
    // untyped JSON at runtime, and `numeric` handing back a number is precisely the drift D6 and
    // `AGENTS.md` forbid. `typeof value === "string"` alone would let it through untouched.
    fetchMock.mockResolvedValue(jsonResponse(withField(ROOM, ["basePrice"], value)));

    await expect(apiGet("/api/manager/motels/x/rooms/y")).rejects.toThrow(/basePrice/);
  });

  it("names the field path in the failure, so a drift report is actionable", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(withField(RENTER_DETAIL, ["activeContract", "monthlyRent"], "n/a")),
    );

    const error = (await apiGet("/api/manager/motels/x/renters/y").catch(
      (cause: unknown) => cause,
    )) as Error;

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error.message).toContain("activeContract.monthlyRent");
  });

  it("leaves a field that is not money alone, including a name that reads like one", async () => {
    // `accountNumber` and `idNumber` are strings the guard must not touch, and `name` is not an
    // amount no matter what it contains. A guard that reached for every string would have refused
    // this response and taken the screen down with it.
    fetchMock.mockResolvedValue(jsonResponse(MOTEL));

    await expect(apiGet<MotelResponse>("/api/manager/motels")).resolves.toEqual(MOTEL);
  });

  it("does not mutate the response it was handed", async () => {
    const body = withField(MOTEL, ["electricityPrice"], "3.500");
    fetchMock.mockResolvedValue(jsonResponse(body));

    await apiGet<MotelResponse>("/api/manager/motels");

    // The decoded body is rebuilt rather than edited in place, so a guard cannot surprise a caller
    // holding the same object.
    expect(body).not.toBe(MOTEL);
    expect((body as MotelResponse).electricityPrice).toBe("3.500");
  });
});

describe("motel paths used by the domain modules", () => {
  it("keeps a uuid path segment intact", async () => {
    fetchMock.mockResolvedValue(jsonResponse([ROOM]));
    const before = MOTEL_ID;

    await apiGet(`/api/manager/motels/${encodeURIComponent(before)}/rooms`);

    expect(fetchMock.mock.calls[0]![0]).toBe(`/api/manager/motels/${before}/rooms`);
  });
});
