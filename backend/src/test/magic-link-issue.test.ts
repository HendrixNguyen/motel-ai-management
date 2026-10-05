import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { magicLinks } from "@/modules/auth/auth.schema";
import { consumeMagicLink, issueMagicLink } from "@/shared/magic-link";

// `resetDb` drops the schema and re-applies every migration, which takes seconds — past
// Bun's 5 s default, and worse once a long run has churned the system catalogs.
setDefaultTimeout(120_000);

beforeEach(resetDb);

const PASSWORD = "aaaaaaaaaa";

interface Manager {
  id: string;
  email: string;
  name: string;
}

/** Registers a manager and logs them in over HTTP, so the test holds a real session cookie. */
async function login(email: string): Promise<{ manager: Manager; cookie: string }> {
  const manager = await registerManager({ email, password: PASSWORD, name: email });
  const res = await app.handle(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    }),
  );
  expect(res.status).toBe(200);
  return { manager, cookie: res.headers.get("set-cookie") ?? "" };
}

async function api(
  method: string,
  path: string,
  options: { cookie?: string; body?: unknown } = {},
): Promise<Response> {
  return app.handle(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(options.cookie === undefined ? {} : { Cookie: options.cookie }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    }),
  );
}

async function createMotel(cookie: string, name = "Nhà trọ"): Promise<{ id: string }> {
  const res = await api("POST", "/manager/motels", {
    cookie,
    body: { name, electricityPrice: "3500", waterPrice: "25000" },
  });
  expect(res.status).toBe(201);
  return await res.json() as { id: string };
}

async function createRoom(cookie: string, motelId: string, name = "P.101"): Promise<{ id: string }> {
  const res = await api("POST", `/manager/motels/${motelId}/rooms`, {
    cookie,
    body: { name, basePrice: "5000000" },
  });
  expect(res.status).toBe(201);
  return await res.json() as { id: string };
}

async function createRenter(cookie: string, motelId: string, phone = "84912345678", roomId?: string): Promise<{ id: string }> {
  const res = await api("POST", `/manager/motels/${motelId}/renters`, {
    cookie,
    body: { name: "Nguyễn Văn A", phone, roomId },
  });
  expect(res.status).toBe(201);
  return await res.json() as { id: string };
}

describe("Manager-Issued Magic Links", () => {
  test("manager can issue a magic link for a renter in their motel", async () => {
    const { cookie } = await login("manager-magic@example.com");
    const { id: motelId } = await createMotel(cookie);
    const { id: renterId } = await createRenter(cookie, motelId);

    const res = await api("POST", `/manager/motels/${motelId}/renters/${renterId}/magic-link`, {
      cookie,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { token: string; url: string };
    expect(body.token).toBeDefined();
    expect(body.url).toBeDefined();
    expect(body.url).toContain(body.token);
    expect(body.url).toContain("http://localhost:3001/r/");
  });

  test("issued token works with existing exchange endpoint", async () => {
    const { cookie } = await login("manager-magic2@example.com");
    const { id: motelId } = await createMotel(cookie);
    const { id: renterId } = await createRenter(cookie, motelId);

    const issueRes = await api("POST", `/manager/motels/${motelId}/renters/${renterId}/magic-link`, {
      cookie,
    });
    expect(issueRes.status).toBe(200);
    const { token } = await issueRes.json() as { token: string; url: string };

    // Use the token with the renter magic-link exchange endpoint
    const exchangeRes = await app.handle(
      new Request("http://localhost/api/renter/magic-links/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );
    expect(exchangeRes.status).toBe(200);
    const exchangeBody = await exchangeRes.json() as { renterId: string; motelId: string };
    expect(exchangeBody.renterId).toBe(renterId);

    // Cookie should be set
    const setCookie = exchangeRes.headers.get("set-cookie");
    expect(setCookie).toContain("renter_session=");
  });

  test("another manager cannot issue link for renter in foreign motel (404)", async () => {
    const { cookie: cookie1 } = await login("manager-magic3a@example.com");
    const { cookie: cookie2 } = await login("manager-magic3b@example.com");
    const { id: motelId1 } = await createMotel(cookie1);
    const { id: renterId } = await createRenter(cookie1, motelId1);

    // Manager 2 tries to issue link for Manager 1's renter
    const res = await api("POST", `/manager/motels/${motelId1}/renters/${renterId}/magic-link`, {
      cookie: cookie2,
    });
    expect(res.status).toBe(404);
  });

  test("renter must belong to the specified motel (404 if mismatch)", async () => {
    const { cookie } = await login("manager-magic4@example.com");
    const { id: motelId1 } = await createMotel(cookie);
    const { id: motelId2 } = await createMotel(cookie); // Same manager, different motel
    const { id: renterId } = await createRenter(cookie, motelId1);

    // Try to issue link with wrong motelId
    const res = await api("POST", `/manager/motels/${motelId2}/renters/${renterId}/magic-link`, {
      cookie,
    });
    expect(res.status).toBe(404);
  });

  test("401 without a manager session", async () => {
    const { cookie } = await login("manager-magic5@example.com");
    const { id: motelId } = await createMotel(cookie);
    const { id: renterId } = await createRenter(cookie, motelId);

    const res = await api("POST", `/manager/motels/${motelId}/renters/${renterId}/magic-link`, {
      // No cookie
    });
    expect(res.status).toBe(401);
  });

  test("404 for non-existent renter", async () => {
    const { cookie } = await login("manager-magic6@example.com");
    const { id: motelId } = await createMotel(cookie);
    const fakeRenterId = "00000000-0000-0000-0000-000000000001";

    const res = await api("POST", `/manager/motels/${motelId}/renters/${fakeRenterId}/magic-link`, {
      cookie,
    });
    expect(res.status).toBe(404);
  });

  test("404 for non-existent motel", async () => {
    const { cookie } = await login("manager-magic7@example.com");
    const { id: motelId } = await createMotel(cookie);
    const { id: renterId } = await createRenter(cookie, motelId);
    const fakeMotelId = "00000000-0000-0000-0000-000000000001";

    const res = await api("POST", `/manager/motels/${fakeMotelId}/renters/${renterId}/magic-link`, {
      cookie,
    });
    expect(res.status).toBe(404);
  });

  test("400 for malformed UUID params", async () => {
    const { cookie } = await login("manager-magic8@example.com");
    const { id: motelId } = await createMotel(cookie);
    const { id: renterId } = await createRenter(cookie, motelId);

    const res = await api("POST", `/manager/motels/not-a-uuid/renters/${renterId}/magic-link`, {
      cookie,
    });
    expect(res.status).toBe(400);
  });
});