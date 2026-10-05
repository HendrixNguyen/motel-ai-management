import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";

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

async function createRenter(cookie: string, motelId: string, phone = "84912345678"): Promise<{ id: string }> {
  const res = await api("POST", `/manager/motels/${motelId}/renters`, {
    cookie,
    body: { name: "Nguyễn Văn A", phone },
  });
  expect(res.status).toBe(201);
  return await res.json() as { id: string };
}

describe("Cross-Tenant Isolation — Sub-Project 2", () => {
  let manager1Cookie: string;
  let manager2Cookie: string;
  let motel1Id: string;
  let motel2Id: string;
  let room1Id: string;
  let room2Id: string;
  let renter1Id: string;
  let renter2Id: string;

  beforeEach(async () => {
    const { cookie: cookie1 } = await login("iso-manager1@example.com");
    const { cookie: cookie2 } = await login("iso-manager2@example.com");
    manager1Cookie = cookie1;
    manager2Cookie = cookie2;

    const { id: m1 } = await createMotel(cookie1, "Motel 1");
    const { id: m2 } = await createMotel(cookie2, "Motel 2");
    motel1Id = m1;
    motel2Id = m2;

    const { id: r1 } = await createRoom(cookie1, motel1Id, "P.101");
    const { id: r2 } = await createRoom(cookie2, motel2Id, "P.201");
    room1Id = r1;
    room2Id = r2;

    const { id: ren1 } = await createRenter(cookie1, motel1Id, "84911111111");
    const { id: ren2 } = await createRenter(cookie2, motel2Id, "84922222222");
    renter1Id = ren1;
    renter2Id = ren2;
  });

  describe("Motel isolation", () => {
    test("Manager A cannot GET Manager B's motel", async () => {
      const res = await api("GET", `/manager/motels/${motel2Id}`, { cookie: manager1Cookie });
      expect(res.status).toBe(404);
    });

    test("Manager A cannot PATCH Manager B's motel", async () => {
      const res = await api("PATCH", `/manager/motels/${motel2Id}`, {
        cookie: manager1Cookie,
        body: { name: "Hacked" },
      });
      expect(res.status).toBe(404);
    });

    test("Manager A cannot DELETE Manager B's motel", async () => {
      const res = await api("DELETE", `/manager/motels/${motel2Id}`, { cookie: manager1Cookie });
      expect(res.status).toBe(404);
    });

    test("Manager A cannot list Manager B's motels", async () => {
      const res = await api("GET", "/manager/motels", { cookie: manager1Cookie });
      expect(res.status).toBe(200);
      const body = await res.json() as { id: string }[];
      expect(body.length).toBe(1);
      expect(body[0]?.id).toBe(motel1Id);
    });
  });

  describe("Room isolation", () => {
    test("Manager A cannot GET Manager B's room", async () => {
      const res = await api("GET", `/manager/motels/${motel2Id}/rooms/${room2Id}`, { cookie: manager1Cookie });
      expect(res.status).toBe(404);
    });

    test("Manager A cannot PATCH Manager B's room", async () => {
      const res = await api("PATCH", `/manager/motels/${motel2Id}/rooms/${room2Id}`, {
        cookie: manager1Cookie,
        body: { name: "Hacked" },
      });
      expect(res.status).toBe(404);
    });

    test("Manager A cannot DELETE Manager B's room", async () => {
      const res = await api("DELETE", `/manager/motels/${motel2Id}/rooms/${room2Id}`, { cookie: manager1Cookie });
      expect(res.status).toBe(404);
    });

    test("Manager A cannot list rooms in Manager B's motel", async () => {
      const res = await api("GET", `/manager/motels/${motel2Id}/rooms`, { cookie: manager1Cookie });
      expect(res.status).toBe(404);
    });

    test("Manager A cannot create room in Manager B's motel", async () => {
      const res = await api("POST", `/manager/motels/${motel2Id}/rooms`, {
        cookie: manager1Cookie,
        body: { name: "P.999", basePrice: "1000000" },
      });
      expect(res.status).toBe(404);
    });
  });

  describe("Renter isolation", () => {
    test("Manager A cannot GET Manager B's renter", async () => {
      const res = await api("GET", `/manager/motels/${motel2Id}/renters/${renter2Id}`, { cookie: manager1Cookie });
      expect(res.status).toBe(404);
    });

    test("Manager A cannot PATCH Manager B's renter", async () => {
      const res = await api("PATCH", `/manager/motels/${motel2Id}/renters/${renter2Id}`, {
        cookie: manager1Cookie,
        body: { name: "Hacked" },
      });
      expect(res.status).toBe(404);
    });

    test("Manager A cannot DELETE Manager B's renter", async () => {
      const res = await api("DELETE", `/manager/motels/${motel2Id}/renters/${renter2Id}`, { cookie: manager1Cookie });
      expect(res.status).toBe(404);
    });

    test("Manager A cannot list renters in Manager B's motel", async () => {
      const res = await api("GET", `/manager/motels/${motel2Id}/renters`, { cookie: manager1Cookie });
      expect(res.status).toBe(404);
    });

    test("Manager A cannot create renter in Manager B's motel", async () => {
      const res = await api("POST", `/manager/motels/${motel2Id}/renters`, {
        cookie: manager1Cookie,
        body: { name: "Hacked Renter", phone: "84999999999" },
      });
      expect(res.status).toBe(404);
    });
  });

  describe("Manager-Issued Magic Link isolation", () => {
    test("Manager A cannot issue magic link for renter in Manager B's motel", async () => {
      const res = await api("POST", `/manager/motels/${motel2Id}/renters/${renter2Id}/magic-link`, {
        cookie: manager1Cookie,
      });
      expect(res.status).toBe(404);
    });

    test("Manager A cannot issue magic link with mismatched motel/renter", async () => {
      const res = await api("POST", `/manager/motels/${motel2Id}/renters/${renter1Id}/magic-link`, {
        cookie: manager1Cookie,
      });
      expect(res.status).toBe(404);
    });
  });

  describe("All cross-tenant denials return 404 (never 403)", () => {
    test("No endpoint returns 403 for cross-tenant access", async () => {
      const endpoints = [
        { method: "GET", path: `/manager/motels/${motel2Id}` },
        { method: "PATCH", path: `/manager/motels/${motel2Id}`, body: { name: "X" } },
        { method: "DELETE", path: `/manager/motels/${motel2Id}` },
        { method: "GET", path: `/manager/motels/${motel2Id}/rooms` },
        { method: "POST", path: `/manager/motels/${motel2Id}/rooms`, body: { name: "X", basePrice: "1" } },
        { method: "GET", path: `/manager/motels/${motel2Id}/rooms/${room2Id}` },
        { method: "PATCH", path: `/manager/motels/${motel2Id}/rooms/${room2Id}`, body: { name: "X" } },
        { method: "DELETE", path: `/manager/motels/${motel2Id}/rooms/${room2Id}` },
        { method: "GET", path: `/manager/motels/${motel2Id}/renters` },
        { method: "POST", path: `/manager/motels/${motel2Id}/renters`, body: { name: "X", phone: "84999999999" } },
        { method: "GET", path: `/manager/motels/${motel2Id}/renters/${renter2Id}` },
        { method: "PATCH", path: `/manager/motels/${motel2Id}/renters/${renter2Id}`, body: { name: "X" } },
        { method: "DELETE", path: `/manager/motels/${motel2Id}/renters/${renter2Id}` },
        { method: "POST", path: `/manager/motels/${motel2Id}/renters/${renter2Id}/magic-link` },
      ];

      for (const { method, path, body } of endpoints) {
        const res = await api(method, path, { cookie: manager1Cookie, body });
        expect(res.status).toBe(404);
      }
    });
  });
});