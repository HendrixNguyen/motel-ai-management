import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { contracts } from "@/modules/contract/contract.schema";

// `resetDb` drops the schema and re-applies every migration, which takes seconds — past
// Bun's 5 s default, and worse once a long run has churned the system catalogs.
setDefaultTimeout(20_000);

beforeEach(resetDb);

const PASSWORD = "aaaaaaaaaa";
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

interface MotelPayload {
  id: string;
}

interface RoomPayload {
  id: string;
  motelId: string;
  name: string;
  basePrice: string;
  floor: number | null;
  status: string;
  createdAt: string;
}

interface ErrorPayload {
  error: string;
  code: string;
}

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

async function createMotel(cookie: string, name = "Nhà trọ"): Promise<MotelPayload> {
  const res = await api("POST", "/manager/motels", {
    cookie,
    body: { name, electricityPrice: "3500", waterPrice: "25000" },
  });
  expect(res.status).toBe(201);
  return (await res.json()) as MotelPayload;
}

async function createRoom(
  cookie: string,
  motelId: string,
  overrides: Record<string, unknown> = {},
): Promise<RoomPayload> {
  const res = await api("POST", `/manager/motels/${motelId}/rooms`, {
    cookie,
    body: { name: "P.101", basePrice: "3500000", ...overrides },
  });
  expect(res.status).toBe(201);
  return (await res.json()) as RoomPayload;
}

/** A room row written straight to the database, for cases the API refuses to create. */
function seedRoom(motelId: string, overrides: Record<string, unknown> = {}) {
  return db
    .insert(rooms)
    .values({ motelId, name: "P.999", ...overrides })
    .returning()
    .then(([row]) => row!);
}

function names(body: RoomPayload[]): string[] {
  return body.map((room) => room.name).sort();
}

describe("GET /api/manager/motels/:motelId/rooms", () => {
  test("returns only the rooms of the requested motel", async () => {
    const a = await login("a@example.com");
    const first = await createMotel(a.cookie, "Nhà trọ một");
    const second = await createMotel(a.cookie, "Nhà trọ hai");
    const inFirst = await createRoom(a.cookie, first.id, { name: "P.101" });
    const alsoInFirst = await createRoom(a.cookie, first.id, { name: "P.102" });
    await createRoom(a.cookie, second.id, { name: "P.201" });

    const res = await api("GET", `/manager/motels/${first.id}/rooms`, { cookie: a.cookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RoomPayload[];
    expect(names(body)).toEqual(["P.101", "P.102"]);
    expect(body.every((room) => room.motelId === first.id)).toBe(true);
    expect(body.map((room) => room.id).sort()).toEqual(
      [inFirst.id, alsoInFirst.id].sort(),
    );
  });

  test("another manager's motel is 404, never 403", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const foreign = await createMotel(b.cookie, "Của B");
    await seedRoom(foreign.id, { name: "P.101" });

    const res = await api("GET", `/manager/motels/${foreign.id}/rooms`, { cookie: a.cookie });
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorPayload).code).toBe("NOT_FOUND");
  });

  test("serialises basePrice as a VND digit string and createdAt as ISO-8601", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await createRoom(a.cookie, motel.id, { basePrice: "3850000" });

    const res = await api("GET", `/manager/motels/${motel.id}/rooms`, { cookie: a.cookie });
    const body = (await res.json()) as RoomPayload[];
    expect(typeof body[0]!.basePrice).toBe("string");
    expect(body[0]!.basePrice).toBe("3850000");
    expect(body[0]!.createdAt).toMatch(ISO_8601);
  });

  test("?floor= keeps only that floor", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await db.insert(rooms).values([
      { motelId: motel.id, name: "P.101", floor: 1 },
      { motelId: motel.id, name: "P.201", floor: 2 },
      { motelId: motel.id, name: "P.301", floor: 3 },
      { motelId: motel.id, name: "P.999" },
    ]);

    const res = await api("GET", `/manager/motels/${motel.id}/rooms?floor=2`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(200);
    expect(names((await res.json()) as RoomPayload[])).toEqual(["P.201"]);
  });

  test("?status= keeps only that status", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await db.insert(rooms).values([
      { motelId: motel.id, name: "P.101", status: "available" },
      { motelId: motel.id, name: "P.102", status: "occupied" },
      { motelId: motel.id, name: "P.103", status: "maintenance" },
    ]);

    const occupied = await api(
      "GET",
      `/manager/motels/${motel.id}/rooms?status=occupied`,
      { cookie: a.cookie },
    );
    expect(occupied.status).toBe(200);
    expect(names((await occupied.json()) as RoomPayload[])).toEqual(["P.102"]);

    const maintenance = await api(
      "GET",
      `/manager/motels/${motel.id}/rooms?status=maintenance`,
      { cookie: a.cookie },
    );
    expect(names((await maintenance.json()) as RoomPayload[])).toEqual(["P.103"]);
  });

  test("?search= matches the room name case-insensitively", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await db.insert(rooms).values([
      { motelId: motel.id, name: "P.101" },
      { motelId: motel.id, name: "P.102" },
      { motelId: motel.id, name: "P.201" },
    ]);

    const res = await api("GET", `/manager/motels/${motel.id}/rooms?search=p.10`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(200);
    expect(names((await res.json()) as RoomPayload[])).toEqual(["P.101", "P.102"]);
  });

  test("?search= treats % and _ as characters, not wildcards", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await db.insert(rooms).values([
      { motelId: motel.id, name: "P.100%" },
      { motelId: motel.id, name: "P.100A" },
      { motelId: motel.id, name: "P.101" },
    ]);

    const percent = await api(
      "GET",
      `/manager/motels/${motel.id}/rooms?search=${encodeURIComponent("100%")}`,
      { cookie: a.cookie },
    );
    expect(names((await percent.json()) as RoomPayload[])).toEqual(["P.100%"]);

    const underscore = await api(
      "GET",
      `/manager/motels/${motel.id}/rooms?search=${encodeURIComponent("P_101")}`,
      { cookie: a.cookie },
    );
    expect(names((await underscore.json()) as RoomPayload[])).toEqual([]);
  });

  test("the filters combine", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await db.insert(rooms).values([
      { motelId: motel.id, name: "P.101", floor: 1, status: "available" },
      { motelId: motel.id, name: "P.102", floor: 1, status: "occupied" },
      { motelId: motel.id, name: "P.201", floor: 2, status: "available" },
    ]);

    const res = await api(
      "GET",
      `/manager/motels/${motel.id}/rooms?floor=1&status=available&search=P.10`,
      { cookie: a.cookie },
    );
    expect(res.status).toBe(200);
    expect(names((await res.json()) as RoomPayload[])).toEqual(["P.101"]);
  });

  test("?roomId= is not a room filter and is ignored", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const target = await createRoom(a.cookie, motel.id, { name: "P.101" });
    await createRoom(a.cookie, motel.id, { name: "P.102" });

    const res = await api(
      "GET",
      `/manager/motels/${motel.id}/rooms?roomId=${target.id}`,
      { cookie: a.cookie },
    );
    expect(res.status).toBe(200);
    expect(names((await res.json()) as RoomPayload[])).toEqual(["P.101", "P.102"]);
  });

  test("an unknown status is 400, not silently ignored", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await createRoom(a.cookie, motel.id, { name: "P.101" });

    const res = await api("GET", `/manager/motels/${motel.id}/rooms?status=vacant`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
  });

  test("a non-integer floor is 400, not silently ignored", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    for (const floor of ["abc", "1.5", ""]) {
      const res = await api(
        "GET",
        `/manager/motels/${motel.id}/rooms?floor=${encodeURIComponent(floor)}`,
        { cookie: a.cookie },
      );
      expect(res.status).toBe(400);
      expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    }
  });

  test("a floor outside the int4 range is 400, not a 500 from the column", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await createRoom(a.cookie, motel.id, { name: "P.101", floor: 1 });

    // `rooms.floor` is int4: anything past ±2147483647 is `22003 integer out of range`.
    const res = await api(
      "GET",
      `/manager/motels/${motel.id}/rooms?floor=${encodeURIComponent("3000000000")}`,
      { cookie: a.cookie },
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    expect(await db.$count(rooms)).toBe(1);
  });

  test("a malformed motelId is 400, not a 500 from the uuid column", async () => {
    const a = await login("a@example.com");
    const res = await api("GET", "/manager/motels/khong-phai-uuid/rooms", { cookie: a.cookie });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
  });

  test("401 without a manager session", async () => {
    const res = await api("GET", "/manager/motels/00000000-0000-4000-8000-00000000dead/rooms");
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorPayload).code).toBe("UNAUTHORIZED");
  });
});

describe("POST /api/manager/motels/:motelId/rooms", () => {
  test("creates a room and returns 201", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    const body = await createRoom(a.cookie, motel.id, {
      name: "P.101",
      basePrice: "3500000",
      floor: 3,
      status: "maintenance",
    });
    expect(body.name).toBe("P.101");
    expect(body.motelId).toBe(motel.id);
    expect(body.basePrice).toBe("3500000");
    expect(body.floor).toBe(3);
    expect(body.status).toBe("maintenance");
    expect(body.createdAt).toMatch(ISO_8601);
  });

  test("floor defaults to null and status to available", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    const body = await createRoom(a.cookie, motel.id, { name: "P.101" });
    expect(body.floor).toBeNull();
    expect(body.status).toBe("available");
  });

  test("409 CONFLICT on a duplicate name in the same motel", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await createRoom(a.cookie, motel.id, { name: "P.101" });

    const res = await api("POST", `/manager/motels/${motel.id}/rooms`, {
      cookie: a.cookie,
      body: { name: "P.101", basePrice: "3500000" },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorPayload;
    expect(body.code).toBe("CONFLICT");
    expect(body.error).toContain("P.101");
    expect(await db.$count(rooms)).toBe(1);
  });

  test("the same room name in another motel is fine", async () => {
    const a = await login("a@example.com");
    const first = await createMotel(a.cookie, "Nhà trọ một");
    const second = await createMotel(a.cookie, "Nhà trọ hai");
    await createRoom(a.cookie, first.id, { name: "P.101" });

    const res = await api("POST", `/manager/motels/${second.id}/rooms`, {
      cookie: a.cookie,
      body: { name: "P.101", basePrice: "3500000" },
    });
    expect(res.status).toBe(201);
    expect(await db.$count(rooms)).toBe(2);
  });

  test("rejects a missing basePrice with 400 VALIDATION_ERROR", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const res = await api("POST", `/manager/motels/${motel.id}/rooms`, {
      cookie: a.cookie,
      body: { name: "P.101" },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    expect(await db.$count(rooms)).toBe(0);
  });

  test("rejects a non-digit basePrice with 400 and stores nothing", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const res = await api("POST", `/manager/motels/${motel.id}/rooms`, {
      cookie: a.cookie,
      body: { name: "P.101", basePrice: "3.5 triệu" },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    expect(await db.$count(rooms)).toBe(0);
  });

  test("rejects a decimal basePrice with 400 — a float never becomes a number", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const res = await api("POST", `/manager/motels/${motel.id}/rooms`, {
      cookie: a.cookie,
      body: { name: "P.101", basePrice: "3500000.5" },
    });
    expect(res.status).toBe(400);
    expect(await db.$count(rooms)).toBe(0);
  });

  test("rejects a JSON number basePrice with 400 — a float never enters the pipeline", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const res = await api("POST", `/manager/motels/${motel.id}/rooms`, {
      cookie: a.cookie,
      body: { name: "P.101", basePrice: 3500000 },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    expect(await db.$count(rooms)).toBe(0);
  });

  test("rejects an oversized basePrice with 400 — numeric(14,0) overflow is a client error", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const res = await api("POST", `/manager/motels/${motel.id}/rooms`, {
      cookie: a.cookie,
      // 15 digits: `numeric_field overflow`, which the error handler can only call a 500.
      body: { name: "P.101", basePrice: "999999999999999" },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    expect(await db.$count(rooms)).toBe(0);
  });

  test("accepts the largest amount numeric(14,0) can hold", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const body = await createRoom(a.cookie, motel.id, {
      name: "P.101",
      basePrice: "99999999999999",
    });
    expect(body.basePrice).toBe("99999999999999");
  });

  test("rejects an empty name with 400 and stores nothing", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const res = await api("POST", `/manager/motels/${motel.id}/rooms`, {
      cookie: a.cookie,
      body: { name: "", basePrice: "3500000" },
    });
    expect(res.status).toBe(400);
    expect(await db.$count(rooms)).toBe(0);
  });

  test("rejects an unknown status with 400 and stores nothing", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const res = await api("POST", `/manager/motels/${motel.id}/rooms`, {
      cookie: a.cookie,
      body: { name: "P.101", basePrice: "3500000", status: "vacant" },
    });
    expect(res.status).toBe(400);
    expect(await db.$count(rooms)).toBe(0);
  });

  test("rejects a floor outside the int4 range with 400 and stores nothing", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    // `rooms.floor` is int4: anything past ±2147483647 is `22003 integer out of range`.
    for (const floor of [3000000000, -3000000000]) {
      const res = await api("POST", `/manager/motels/${motel.id}/rooms`, {
        cookie: a.cookie,
        body: { name: "P.101", basePrice: "3500000", floor },
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    }
    expect(await db.$count(rooms)).toBe(0);
  });

  test("accepts both int4 extremes of floor", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    const highest = await createRoom(a.cookie, motel.id, {
      name: "P.101",
      floor: 2147483647,
    });
    expect(highest.floor).toBe(2147483647);

    const lowest = await createRoom(a.cookie, motel.id, {
      name: "P.102",
      floor: -2147483648,
    });
    expect(lowest.floor).toBe(-2147483648);
  });

  test("a motelId in the body cannot move the room to another motel", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const mine = await createMotel(a.cookie);
    const theirs = await createMotel(b.cookie, "Của B");

    const body = await createRoom(a.cookie, mine.id, {
      name: "P.101",
      motelId: theirs.id,
      managerId: b.manager.id,
    });
    expect(body.motelId).toBe(mine.id);
    const [stored] = await db.select().from(rooms);
    expect(stored!.motelId).toBe(mine.id);
  });

  test("404 for another manager's motel, and nothing is stored", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const foreign = await createMotel(b.cookie, "Của B");

    const res = await api("POST", `/manager/motels/${foreign.id}/rooms`, {
      cookie: a.cookie,
      body: { name: "P.101", basePrice: "3500000" },
    });
    expect(res.status).toBe(404);
    expect(await db.$count(rooms)).toBe(0);
  });

  test("401 without a manager session", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const res = await api("POST", `/manager/motels/${motel.id}/rooms`, {
      body: { name: "P.101", basePrice: "3500000" },
    });
    expect(res.status).toBe(401);
    expect(await db.$count(rooms)).toBe(0);
  });
});

describe("GET /api/manager/motels/:motelId/rooms/:roomId", () => {
  test("returns the room with a digit-string basePrice", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, {
      name: "P.101",
      basePrice: "3500000",
      floor: 2,
    });

    const res = await api("GET", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RoomPayload;
    expect(body.id).toBe(created.id);
    expect(typeof body.basePrice).toBe("string");
    expect(body.basePrice).toBe("3500000");
    expect(body.floor).toBe(2);
    expect(body.createdAt).toMatch(ISO_8601);
  });

  test("another manager's room is 404, never 403", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const foreign = await createMotel(b.cookie, "Của B");
    const room = await seedRoom(foreign.id, { name: "P.101" });

    const res = await api("GET", `/manager/motels/${foreign.id}/rooms/${room.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorPayload).code).toBe("NOT_FOUND");
  });

  test("the caller's room under a different motel of the same manager is 404", async () => {
    const a = await login("a@example.com");
    const first = await createMotel(a.cookie, "Nhà trọ một");
    const second = await createMotel(a.cookie, "Nhà trọ hai");
    const room = await createRoom(a.cookie, second.id, { name: "P.101" });

    const res = await api("GET", `/manager/motels/${first.id}/rooms/${room.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorPayload).code).toBe("NOT_FOUND");
  });

  test("a room that does not exist is 404", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const res = await api(
      "GET",
      `/manager/motels/${motel.id}/rooms/00000000-0000-4000-8000-00000000dead`,
      { cookie: a.cookie },
    );
    expect(res.status).toBe(404);
  });

  test("a malformed roomId is 400, not a 500 from the uuid column", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const res = await api("GET", `/manager/motels/${motel.id}/rooms/khong-phai-uuid`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
  });
});

describe("PATCH /api/manager/motels/:motelId/rooms/:roomId", () => {
  test("updates name, floor, basePrice and status", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101" });

    const res = await api("PATCH", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
      body: { name: "P.111", floor: 4, basePrice: "4000000", status: "maintenance" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RoomPayload;
    expect(body.name).toBe("P.111");
    expect(body.floor).toBe(4);
    expect(body.basePrice).toBe("4000000");
    expect(body.status).toBe("maintenance");
  });

  test("leaves fields absent from the body alone", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, {
      name: "P.101",
      floor: 2,
      status: "occupied",
    });

    const res = await api("PATCH", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
      body: { name: "P.102" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RoomPayload;
    expect(body.name).toBe("P.102");
    expect(body.floor).toBe(2);
    expect(body.status).toBe("occupied");
    expect(body.basePrice).toBe("3500000");
  });

  test("an empty body changes nothing", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101", floor: 5 });

    const res = await api("PATCH", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
      body: {},
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RoomPayload;
    expect(body.name).toBe("P.101");
    expect(body.floor).toBe(5);
    expect(body.basePrice).toBe("3500000");
  });

  test("an explicit null floor clears it", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101", floor: 5 });

    const res = await api("PATCH", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
      body: { floor: null },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as RoomPayload).floor).toBeNull();
  });

  test("409 on renaming to a name already used in the same motel", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await createRoom(a.cookie, motel.id, { name: "P.101" });
    const other = await createRoom(a.cookie, motel.id, { name: "P.102" });

    const res = await api("PATCH", `/manager/motels/${motel.id}/rooms/${other.id}`, {
      cookie: a.cookie,
      body: { name: "P.101" },
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as ErrorPayload).code).toBe("CONFLICT");
    expect((await db.select({ name: rooms.name }).from(rooms))[1]!.name).toBe("P.102");
  });

  test("renaming to a name used in another motel is fine", async () => {
    const a = await login("a@example.com");
    const first = await createMotel(a.cookie, "Nhà trọ một");
    const second = await createMotel(a.cookie, "Nhà trọ hai");
    await createRoom(a.cookie, first.id, { name: "P.101" });
    const mine = await createRoom(a.cookie, second.id, { name: "P.102" });

    const res = await api("PATCH", `/manager/motels/${second.id}/rooms/${mine.id}`, {
      cookie: a.cookie,
      body: { name: "P.101" },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as RoomPayload).name).toBe("P.101");
  });

  test("rejects a non-digit basePrice with 400 and leaves the stored price intact", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101" });

    const res = await api("PATCH", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
      body: { basePrice: "3.5 triệu" },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    const [stored] = await db.select().from(rooms);
    expect(stored!.basePrice).toBe("3500000");
  });

  test("rejects a JSON number basePrice with 400 and leaves the stored price intact", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101" });

    const res = await api("PATCH", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
      body: { basePrice: 3500000 },
    });
    expect(res.status).toBe(400);
    const [stored] = await db.select().from(rooms);
    expect(stored!.basePrice).toBe("3500000");
  });

  test("rejects an oversized basePrice with 400 and leaves the stored price intact", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101" });

    const res = await api("PATCH", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
      body: { basePrice: "999999999999999" },
    });
    expect(res.status).toBe(400);
    const [stored] = await db.select().from(rooms);
    expect(stored!.basePrice).toBe("3500000");
  });

  test("rejects an unknown status with 400 and leaves the stored status intact", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101" });

    const res = await api("PATCH", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
      body: { status: "vacant" },
    });
    expect(res.status).toBe(400);
    const [stored] = await db.select().from(rooms);
    expect(stored!.status).toBe("available");
  });

  test("rejects a non-integer floor with 400", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101", floor: 1 });

    const res = await api("PATCH", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
      body: { floor: 1.5 },
    });
    expect(res.status).toBe(400);
    const [stored] = await db.select().from(rooms);
    expect(stored!.floor).toBe(1);
  });

  test("rejects a floor outside the int4 range with 400 and leaves the stored floor intact", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101", floor: 1 });

    const res = await api("PATCH", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
      // `rooms.floor` is int4: anything past ±2147483647 is `22003 integer out of range`.
      body: { floor: 3000000000 },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    const [stored] = await db.select().from(rooms);
    expect(stored!.floor).toBe(1);
  });

  test("another manager's room is 404 and is not modified", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const foreign = await createMotel(b.cookie, "Của B");
    const room = await seedRoom(foreign.id, { name: "P.101" });

    const res = await api("PATCH", `/manager/motels/${foreign.id}/rooms/${room.id}`, {
      cookie: a.cookie,
      body: { name: "Bị đổi" },
    });
    expect(res.status).toBe(404);
    const [stored] = await db.select({ name: rooms.name }).from(rooms);
    expect(stored!.name).toBe("P.101");
  });

  test("the caller's room under a different motel is 404 and is not modified", async () => {
    const a = await login("a@example.com");
    const first = await createMotel(a.cookie, "Nhà trọ một");
    const second = await createMotel(a.cookie, "Nhà trọ hai");
    const room = await createRoom(a.cookie, second.id, { name: "P.101" });

    const res = await api("PATCH", `/manager/motels/${first.id}/rooms/${room.id}`, {
      cookie: a.cookie,
      body: { name: "Bị đổi" },
    });
    expect(res.status).toBe(404);
    const [stored] = await db.select({ name: rooms.name }).from(rooms);
    expect(stored!.name).toBe("P.101");
  });
});

describe("DELETE /api/manager/motels/:motelId/rooms/:roomId", () => {
  /** A renter assigned to `roomId`, plus an active contract tying the two together. */
  async function seedContract(roomId: string, motelId: string) {
    const [renter] = await db
      .insert(renters)
      .values({ motelId, name: "Nguyễn Văn A", phone: "84901234567", roomId })
      .returning();
    await db.insert(contracts).values({
      renterId: renter!.id,
      roomId,
      motelId,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      monthlyRent: "3500000",
      status: "active",
    });
  }

  test("204 and the row is gone when nothing depends on the room", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101" });

    const res = await api("DELETE", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(204);
    expect(await db.$count(rooms)).toBe(0);
  });

  test("409 CONFLICT when an active contract exists, and the message names the contract", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101" });
    await seedContract(created.id, motel.id);

    const res = await api("DELETE", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorPayload;
    expect(body.code).toBe("CONFLICT");
    expect(body.error).toContain("hợp đồng");
    expect(body.error).not.toContain("người thuê");
    expect(await db.$count(rooms)).toBe(1);
  });

  test("409 CONFLICT when a renter is assigned, and the message names the renter", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101" });
    await db.insert(renters).values({
      motelId: motel.id,
      name: "Nguyễn Văn A",
      phone: "84901234567",
      roomId: created.id,
    });

    const res = await api("DELETE", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorPayload;
    expect(body.code).toBe("CONFLICT");
    expect(body.error).toContain("người thuê");
    expect(body.error).not.toContain("hợp đồng");
    expect(await db.$count(rooms)).toBe(1);
  });

  test("409 CONFLICT when an inactive renter is still assigned — the foreign key ignores status", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101" });
    await db.insert(renters).values({
      motelId: motel.id,
      name: "Nguyễn Văn B",
      phone: "84901234568",
      roomId: created.id,
      status: "inactive",
    });

    const res = await api("DELETE", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as ErrorPayload).code).toBe("CONFLICT");
    expect(await db.$count(rooms)).toBe(1);
  });

  test("204 once the renter has been moved out", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101" });
    await db.insert(renters).values({
      motelId: motel.id,
      name: "Nguyễn Văn A",
      phone: "84901234567",
      roomId: created.id,
    });

    await db.update(renters).set({ roomId: null });
    const res = await api("DELETE", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(204);
    expect(await db.$count(rooms)).toBe(0);
  });

  test("409 CONFLICT when a draft contract still references the room, not a 500", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101" });
    // A renter who is *not* assigned to the room, so the two counted guards both come back
    // empty and the raw delete is what meets the foreign key.
    const [renter] = await db
      .insert(renters)
      .values({ motelId: motel.id, name: "Nguyễn Văn A", phone: "84901234567" })
      .returning();
    await db.insert(contracts).values({
      renterId: renter!.id,
      roomId: created.id,
      motelId: motel.id,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      monthlyRent: "3500000",
      status: "draft",
    });

    const res = await api("DELETE", `/manager/motels/${motel.id}/rooms/${created.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorPayload;
    expect(body.code).toBe("CONFLICT");
    // The generic guard, so the message must not claim it was a contract or a renter.
    expect(body.error).toContain("tham chiếu");
    expect(body.error).not.toContain("hợp đồng");
    expect(body.error).not.toContain("người thuê");
    expect(await db.$count(rooms)).toBe(1);
  });

  test("404 for another manager's room, and the room survives", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const foreign = await createMotel(b.cookie, "Của B");
    const room = await seedRoom(foreign.id, { name: "P.101" });

    const res = await api("DELETE", `/manager/motels/${foreign.id}/rooms/${room.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(404);
    expect(await db.$count(rooms)).toBe(1);
  });

  test("the caller's room under a different motel is 404 and survives", async () => {
    const a = await login("a@example.com");
    const first = await createMotel(a.cookie, "Nhà trọ một");
    const second = await createMotel(a.cookie, "Nhà trọ hai");
    const room = await createRoom(a.cookie, second.id, { name: "P.101" });

    const res = await api("DELETE", `/manager/motels/${first.id}/rooms/${room.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(404);
    expect(await db.$count(rooms)).toBe(1);
  });

  test("401 without a manager session", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const created = await createRoom(a.cookie, motel.id, { name: "P.101" });

    const res = await api("DELETE", `/manager/motels/${motel.id}/rooms/${created.id}`);
    expect(res.status).toBe(401);
    expect(await db.$count(rooms)).toBe(1);
  });
});