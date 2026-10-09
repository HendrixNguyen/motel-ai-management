import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { billingPeriods, invoices } from "@/modules/billing/billing.schema";
import { contracts } from "@/modules/contract/contract.schema";
import { renters } from "@/modules/renter/renter.schema";
import { rooms } from "@/modules/room/room.schema";

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
}

interface RenterPayload {
  id: string;
  motelId: string;
  name: string;
  phone: string;
  idNumber: string | null;
  idCardFrontUrl: string | null;
  idCardBackUrl: string | null;
  roomId: string | null;
  zaloOaId: string | null;
  isOaFollower: boolean;
  status: string;
  createdAt: string;
}

interface ContractSummaryPayload {
  id: string;
  roomId: string;
  roomName: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
}

interface InvoiceSummaryPayload {
  id: string;
  billingPeriodId: string;
  totalAmount: string;
  paymentStatus: string;
  createdAt: string;
}

interface RenterDetailPayload extends RenterPayload {
  activeContract: ContractSummaryPayload | null;
  invoices: InvoiceSummaryPayload[];
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

async function createRenter(
  cookie: string,
  motelId: string,
  overrides: Record<string, unknown> = {},
): Promise<RenterPayload> {
  const res = await api("POST", `/manager/motels/${motelId}/renters`, {
    cookie,
    body: { name: "Nguyễn Văn A", phone: "0901234567", ...overrides },
  });
  expect(res.status).toBe(201);
  return (await res.json()) as RenterPayload;
}

/** A renter row written straight to the database, for cases the API refuses to create. */
async function seedRenter(motelId: string, overrides: Record<string, unknown> = {}) {
  const [row] = await db
    .insert(renters)
    .values({ motelId, name: "Nguyễn Văn A", phone: "84901234567", ...overrides })
    .returning();
  return row!;
}

async function seedContract(
  renterId: string,
  roomId: string,
  motelId: string,
  overrides: Partial<typeof contracts.$inferInsert> = {},
) {
  const [row] = await db
    .insert(contracts)
    .values({
      renterId,
      roomId,
      motelId,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      monthlyRent: "3500000",
      status: "active",
      ...overrides,
    })
    .returning();
  return row!;
}

/**
 * One billing period plus its invoice for `renterId`. `month` keeps the periods unique, since a
 * motel has at most one period per month and an invoice is unique per (period, room).
 */
async function seedInvoice(
  renterId: string,
  roomId: string,
  motelId: string,
  month: number,
  overrides: Partial<typeof invoices.$inferInsert> = {},
) {
  const [period] = await db
    .insert(billingPeriods)
    .values({ motelId, month, year: 2026 })
    .returning();
  const [invoice] = await db
    .insert(invoices)
    .values({
      billingPeriodId: period!.id,
      roomId,
      renterId,
      motelId,
      rentAmount: "3500000",
      electricityUsage: "10",
      electricityCost: "35000",
      waterUsage: "1",
      waterCost: "25000",
      totalAmount: "3560000",
      ...overrides,
    })
    .returning();
  return invoice!;
}

function names(body: RenterPayload[]): string[] {
  return body.map((renter) => renter.name).sort();
}

describe("GET /api/manager/motels/:motelId/renters", () => {
  test("returns only the renters of the requested motel", async () => {
    const a = await login("a@example.com");
    const first = await createMotel(a.cookie, "Nhà trọ một");
    const second = await createMotel(a.cookie, "Nhà trọ hai");
    const inFirst = await createRenter(a.cookie, first.id, { name: "Nguyễn Văn A" });
    const alsoInFirst = await createRenter(a.cookie, first.id, {
      name: "Nguyễn Văn B",
      phone: "0907654321",
    });
    await createRenter(a.cookie, second.id, { name: "Trần Văn C", phone: "0901112222" });

    const res = await api("GET", `/manager/motels/${first.id}/renters`, { cookie: a.cookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RenterPayload[];
    expect(names(body)).toEqual(["Nguyễn Văn A", "Nguyễn Văn B"]);
    expect(body.every((renter) => renter.motelId === first.id)).toBe(true);
    expect(body.map((renter) => renter.id).sort()).toEqual([inFirst.id, alsoInFirst.id].sort());
  });

  test("another manager's motel is 404, never 403", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const foreign = await createMotel(b.cookie, "Của B");
    await seedRenter(foreign.id);

    const res = await api("GET", `/manager/motels/${foreign.id}/renters`, { cookie: a.cookie });
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorPayload).code).toBe("NOT_FOUND");
  });

  test("serialises the phone as stored digits and createdAt as ISO-8601", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await createRenter(a.cookie, motel.id, { phone: "0901234567" });

    const res = await api("GET", `/manager/motels/${motel.id}/renters`, { cookie: a.cookie });
    const body = (await res.json()) as RenterPayload[];
    expect(typeof body[0]!.phone).toBe("string");
    expect(body[0]!.phone).toBe("84901234567");
    expect(body[0]!.createdAt).toMatch(ISO_8601);
  });

  test("?status= keeps only that status", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await seedRenter(motel.id, { name: "Nguyễn Văn A" });
    await seedRenter(motel.id, { name: "Nguyễn Văn B", phone: "84907654321", status: "inactive" });

    const active = await api(
      "GET",
      `/manager/motels/${motel.id}/renters?status=active`,
      { cookie: a.cookie },
    );
    expect(active.status).toBe(200);
    expect(names((await active.json()) as RenterPayload[])).toEqual(["Nguyễn Văn A"]);

    const inactive = await api(
      "GET",
      `/manager/motels/${motel.id}/renters?status=inactive`,
      { cookie: a.cookie },
    );
    expect(names((await inactive.json()) as RenterPayload[])).toEqual(["Nguyễn Văn B"]);
  });

  test("?roomId= keeps only that room's renters", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const first = await createRoom(a.cookie, motel.id, { name: "P.101" });
    const second = await createRoom(a.cookie, motel.id, { name: "P.102" });
    await createRenter(a.cookie, motel.id, { name: "Nguyễn Văn A", roomId: first.id });
    await createRenter(a.cookie, motel.id, {
      name: "Nguyễn Văn B",
      phone: "0907654321",
      roomId: second.id,
    });
    await createRenter(a.cookie, motel.id, { name: "Chưa có phòng", phone: "0901112222" });

    const res = await api("GET", `/manager/motels/${motel.id}/renters?roomId=${first.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(200);
    expect(names((await res.json()) as RenterPayload[])).toEqual(["Nguyễn Văn A"]);
  });

  test("?search= matches the name case-insensitively and the stored phone", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await seedRenter(motel.id, { name: "Nguyễn Văn A", phone: "84901234567" });
    await seedRenter(motel.id, { name: "Trần Văn B", phone: "84907654321" });

    const byName = await api(
      "GET",
      `/manager/motels/${motel.id}/renters?search=${encodeURIComponent("nguyễn")}`,
      { cookie: a.cookie },
    );
    expect(byName.status).toBe(200);
    expect(names((await byName.json()) as RenterPayload[])).toEqual(["Nguyễn Văn A"]);

    const byPhone = await api(
      "GET",
      `/manager/motels/${motel.id}/renters?search=8490765`,
      { cookie: a.cookie },
    );
    expect(names((await byPhone.json()) as RenterPayload[])).toEqual(["Trần Văn B"]);
  });

  test("?search= treats % and _ as characters, not wildcards", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await seedRenter(motel.id, { name: "Nguyễn 100%", phone: "84901234567" });
    await seedRenter(motel.id, { name: "Nguyễn 100A", phone: "84907654321" });
    await seedRenter(motel.id, { name: "Nguyễn 100B", phone: "84955566677" });

    const percent = await api(
      "GET",
      `/manager/motels/${motel.id}/renters?search=${encodeURIComponent("100%")}`,
      { cookie: a.cookie },
    );
    expect(names((await percent.json()) as RenterPayload[])).toEqual(["Nguyễn 100%"]);

    const underscore = await api(
      "GET",
      `/manager/motels/${motel.id}/renters?search=${encodeURIComponent("100_")}`,
      { cookie: a.cookie },
    );
    expect(names((await underscore.json()) as RenterPayload[])).toEqual([]);
  });

  test("the filters combine", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const room = await createRoom(a.cookie, motel.id);
    await seedRenter(motel.id, { name: "Nguyễn Văn A", roomId: room.id });
    await seedRenter(motel.id, { name: "Nguyễn Văn B", phone: "84907654321", roomId: room.id });
    await seedRenter(motel.id, {
      name: "Nguyễn Văn C",
      phone: "84955566677",
      roomId: room.id,
      status: "inactive",
    });

    const res = await api(
      "GET",
      `/manager/motels/${motel.id}/renters?status=active&roomId=${room.id}&search=${encodeURIComponent("Văn")}`,
      { cookie: a.cookie },
    );
    expect(res.status).toBe(200);
    expect(names((await res.json()) as RenterPayload[])).toEqual(["Nguyễn Văn A", "Nguyễn Văn B"]);
  });

  test("an unknown status is 400, not silently ignored", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await createRenter(a.cookie, motel.id);

    const res = await api("GET", `/manager/motels/${motel.id}/renters?status=vacant`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
  });

  test("a malformed motelId or roomId is 400, not a 500 from the uuid column", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    const badMotel = await api("GET", "/manager/motels/khong-phai-uuid/renters", {
      cookie: a.cookie,
    });
    expect(badMotel.status).toBe(400);
    expect(((await badMotel.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");

    const badRoom = await api(
      "GET",
      `/manager/motels/${motel.id}/renters?roomId=khong-phai-uuid`,
      { cookie: a.cookie },
    );
    expect(badRoom.status).toBe(400);
    expect(((await badRoom.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
  });

  test("401 without a manager session", async () => {
    const res = await api(
      "GET",
      "/manager/motels/00000000-0000-4000-8000-00000000dead/renters",
    );
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorPayload).code).toBe("UNAUTHORIZED");
  });
});

describe("POST /api/manager/motels/:motelId/renters", () => {
  test("creates a renter and returns 201 with the phone normalised", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    const res = await api("POST", `/manager/motels/${motel.id}/renters`, {
      cookie: a.cookie,
      body: { name: "Nguyễn Văn A", phone: "0901234567" },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as RenterPayload;
    expect(body.name).toBe("Nguyễn Văn A");
    expect(body.motelId).toBe(motel.id);
    expect(body.phone).toBe("84901234567");
    expect(body.createdAt).toMatch(ISO_8601);
  });

  test("roomId, status and the document fields are stored as given", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const room = await createRoom(a.cookie, motel.id);

    const body = await createRenter(a.cookie, motel.id, {
      roomId: room.id,
      idNumber: "079088012345",
      idCardFrontUrl: "https://r2.example.com/front.jpg",
      idCardBackUrl: "https://r2.example.com/back.jpg",
    });
    expect(body.roomId).toBe(room.id);
    expect(body.idNumber).toBe("079088012345");
    expect(body.idCardFrontUrl).toBe("https://r2.example.com/front.jpg");
    expect(body.idCardBackUrl).toBe("https://r2.example.com/back.jpg");
  });

  test("roomId and status default to the column defaults", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    const body = await createRenter(a.cookie, motel.id);
    expect(body.roomId).toBeNull();
    expect(body.status).toBe("active");
    expect(body.idNumber).toBeNull();
    expect(body.isOaFollower).toBe(false);
  });

  test("the 201 body claims no delivery — the welcome ZNS is a later sub-project", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    const res = await api("POST", `/manager/motels/${motel.id}/renters`, {
      cookie: a.cookie,
      body: { name: "Nguyễn Văn A", phone: "0901234567" },
    });
    expect(res.status).toBe(201);
    const raw = (await res.json()) as Record<string, unknown>;
    expect(raw.token).toBeUndefined();
    expect(raw.url).toBeUndefined();
    expect(raw.znsToken).toBeUndefined();
  });

  test("409 CONFLICT on a duplicate phone in the same motel", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await createRenter(a.cookie, motel.id, { phone: "0901234567" });

    const res = await api("POST", `/manager/motels/${motel.id}/renters`, {
      cookie: a.cookie,
      // The same person written a second way round: normalisation makes it the same key.
      body: { name: "Nguyễn Văn A", phone: "+84 901 234 567" },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorPayload;
    expect(body.code).toBe("CONFLICT");
    expect(body.error).toContain("84901234567");
    expect(await db.$count(renters)).toBe(1);
  });

  test("the same phone in another motel is fine", async () => {
    const a = await login("a@example.com");
    const first = await createMotel(a.cookie, "Nhà trọ một");
    const second = await createMotel(a.cookie, "Nhà trọ hai");
    await createRenter(a.cookie, first.id, { phone: "0901234567" });

    const res = await api("POST", `/manager/motels/${second.id}/renters`, {
      cookie: a.cookie,
      body: { name: "Nguyễn Văn A", phone: "0901234567" },
    });
    expect(res.status).toBe(201);
    expect(await db.$count(renters)).toBe(2);
  });

  test("rejects a malformed phone with 400 and stores nothing", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    for (const phone of ["12345", "09012345", "+1 202 555 0143"]) {
      const res = await api("POST", `/manager/motels/${motel.id}/renters`, {
        cookie: a.cookie,
        body: { name: "Nguyễn Văn A", phone },
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    }
    expect(await db.$count(renters)).toBe(0);
  });

  test("rejects an empty name, a missing phone and a JSON number phone with 400", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    for (const body of [
      { name: "", phone: "0901234567" },
      { name: "Nguyễn Văn A" },
      { name: "Nguyễn Văn A", phone: 901234567 },
    ]) {
      const res = await api("POST", `/manager/motels/${motel.id}/renters`, {
        cookie: a.cookie,
        body,
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    }
    expect(await db.$count(renters)).toBe(0);
  });

  test("404 for a room in another motel, and nothing is stored", async () => {
    const a = await login("a@example.com");
    const mine = await createMotel(a.cookie, "Của A");
    const other = await createMotel(a.cookie, "Nhà trọ khác");
    const foreignRoom = await createRoom(a.cookie, other.id, { name: "P.201" });

    const res = await api("POST", `/manager/motels/${mine.id}/renters`, {
      cookie: a.cookie,
      body: { name: "Nguyễn Văn A", phone: "0901234567", roomId: foreignRoom.id },
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorPayload).code).toBe("NOT_FOUND");
    expect(await db.$count(renters)).toBe(0);
  });

  test("404 for a room that does not exist", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    const res = await api("POST", `/manager/motels/${motel.id}/renters`, {
      cookie: a.cookie,
      body: {
        name: "Nguyễn Văn A",
        phone: "0901234567",
        roomId: "00000000-0000-4000-8000-00000000dead",
      },
    });
    expect(res.status).toBe(404);
    expect(await db.$count(renters)).toBe(0);
  });

  test("a motelId in the body cannot move the renter to another motel", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const mine = await createMotel(a.cookie);
    const theirs = await createMotel(b.cookie, "Của B");

    const body = await createRenter(a.cookie, mine.id, {
      motelId: theirs.id,
      managerId: b.manager.id,
    });
    expect(body.motelId).toBe(mine.id);
    const [stored] = await db.select().from(renters);
    expect(stored!.motelId).toBe(mine.id);
  });

  test("404 for another manager's motel, and nothing is stored", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const foreign = await createMotel(b.cookie, "Của B");

    const res = await api("POST", `/manager/motels/${foreign.id}/renters`, {
      cookie: a.cookie,
      body: { name: "Nguyễn Văn A", phone: "0901234567" },
    });
    expect(res.status).toBe(404);
    expect(await db.$count(renters)).toBe(0);
  });

  test("401 without a manager session", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    const res = await api("POST", `/manager/motels/${motel.id}/renters`, {
      body: { name: "Nguyễn Văn A", phone: "0901234567" },
    });
    expect(res.status).toBe(401);
    expect(await db.$count(renters)).toBe(0);
  });
});

describe("GET /api/manager/motels/:motelId/renters/:renterId", () => {
  test("includes the active contract summary with its room name, dates and rent", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const room = await createRoom(a.cookie, motel.id, { name: "P.101" });
    const renter = await createRenter(a.cookie, motel.id, { roomId: room.id });
    const contract = await seedContract(renter.id, room.id, motel.id, { monthlyRent: "3500000" });

    const res = await api("GET", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RenterDetailPayload;
    expect(body.id).toBe(renter.id);
    expect(body.activeContract).not.toBeNull();
    expect(body.activeContract!.id).toBe(contract.id);
    expect(body.activeContract!.roomId).toBe(room.id);
    expect(body.activeContract!.roomName).toBe("P.101");
    expect(body.activeContract!.startDate).toBe("2026-01-01");
    expect(body.activeContract!.endDate).toBe("2026-12-31");
    expect(typeof body.activeContract!.monthlyRent).toBe("string");
    expect(body.activeContract!.monthlyRent).toBe("3500000");
  });

  test("a contract that is not active is not the summary", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const room = await createRoom(a.cookie, motel.id);
    const renter = await createRenter(a.cookie, motel.id, { roomId: room.id });
    await seedContract(renter.id, room.id, motel.id, { status: "draft" });

    const res = await api("GET", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
    });
    expect(((await res.json()) as RenterDetailPayload).activeContract).toBeNull();
  });

  test("includes the five most recent invoices, newest first", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const room = await createRoom(a.cookie, motel.id);
    const renter = await createRenter(a.cookie, motel.id, { roomId: room.id });
    for (let month = 1; month <= 6; month++) {
      await seedInvoice(renter.id, room.id, motel.id, month, {
        createdAt: new Date(`2026-${String(month).padStart(2, "0")}-01T00:00:00.000Z`),
        paymentStatus: month === 6 ? "paid" : "unpaid",
        totalAmount: `${3000000 + month * 1000}`,
      });
    }

    const res = await api("GET", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
    });
    const body = (await res.json()) as RenterDetailPayload;
    expect(body.invoices).toHaveLength(5);
    expect(body.invoices.map((invoice) => invoice.createdAt)).toEqual([
      "2026-06-01T00:00:00.000Z",
      "2026-05-01T00:00:00.000Z",
      "2026-04-01T00:00:00.000Z",
      "2026-03-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
    ]);
    expect(body.invoices[0]!.paymentStatus).toBe("paid");
    expect(typeof body.invoices[0]!.totalAmount).toBe("string");
    expect(body.invoices[0]!.totalAmount).toBe("3006000");
    expect(body.invoices[0]!.billingPeriodId).toBeTruthy();
  });

  test("another renter's invoices stay out of the history", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const room = await createRoom(a.cookie, motel.id);
    const mine = await createRenter(a.cookie, motel.id, { roomId: room.id });
    const theirs = await createRenter(a.cookie, motel.id, {
      name: "Nguyễn Văn B",
      phone: "0907654321",
      roomId: room.id,
    });
    await seedInvoice(theirs.id, room.id, motel.id, 1);

    const res = await api("GET", `/manager/motels/${motel.id}/renters/${mine.id}`, {
      cookie: a.cookie,
    });
    expect(((await res.json()) as RenterDetailPayload).invoices).toEqual([]);
  });

  test("no active contract and no invoices is a valid state, not an error", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const renter = await createRenter(a.cookie, motel.id);

    const res = await api("GET", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RenterDetailPayload;
    expect(body.activeContract).toBeNull();
    expect(body.invoices).toEqual([]);
    expect(body.name).toBe("Nguyễn Văn A");
  });

  test("another manager's renter is 404, never 403", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const foreign = await createMotel(b.cookie, "Của B");
    const renter = await seedRenter(foreign.id);

    const res = await api("GET", `/manager/motels/${foreign.id}/renters/${renter.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorPayload).code).toBe("NOT_FOUND");
  });

  test("the caller's renter under a different motel of the same manager is 404", async () => {
    const a = await login("a@example.com");
    const first = await createMotel(a.cookie, "Nhà trọ một");
    const second = await createMotel(a.cookie, "Nhà trọ hai");
    const renter = await createRenter(a.cookie, second.id);

    const res = await api("GET", `/manager/motels/${first.id}/renters/${renter.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorPayload).code).toBe("NOT_FOUND");
  });

  test("a renter that does not exist is 404", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    const res = await api(
      "GET",
      `/manager/motels/${motel.id}/renters/00000000-0000-4000-8000-00000000dead`,
      { cookie: a.cookie },
    );
    expect(res.status).toBe(404);
  });

  test("a malformed renterId is 400, not a 500 from the uuid column", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);

    const res = await api("GET", `/manager/motels/${motel.id}/renters/khong-phai-uuid`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
  });

  test("401 without a manager session", async () => {
    const res = await api(
      "GET",
      "/manager/motels/00000000-0000-4000-8000-00000000dead/renters/00000000-0000-4000-8000-00000000dead",
    );
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorPayload).code).toBe("UNAUTHORIZED");
  });
});

describe("PATCH /api/manager/motels/:motelId/renters/:renterId", () => {
  test("updates the name, the CCCD and both card urls", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const renter = await createRenter(a.cookie, motel.id);

    const res = await api("PATCH", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
      body: {
        name: "Nguyễn Văn B",
        idNumber: "079088012345",
        idCardFrontUrl: "https://r2.example.com/front.jpg",
        idCardBackUrl: "https://r2.example.com/back.jpg",
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RenterPayload;
    expect(body.name).toBe("Nguyễn Văn B");
    expect(body.idNumber).toBe("079088012345");
    expect(body.idCardFrontUrl).toBe("https://r2.example.com/front.jpg");
    expect(body.idCardBackUrl).toBe("https://r2.example.com/back.jpg");
  });

  test("normalises the phone before writing it", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const renter = await createRenter(a.cookie, motel.id);

    const res = await api("PATCH", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
      body: { phone: "090.765.4321" },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as RenterPayload).phone).toBe("84907654321");
    const [stored] = await db.select({ phone: renters.phone }).from(renters);
    expect(stored!.phone).toBe("84907654321");
  });

  test("leaves fields absent from the body alone", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const renter = await createRenter(a.cookie, motel.id, {
      roomId: null,
      idNumber: "079088012345",
    });

    const res = await api("PATCH", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
      body: { name: "Nguyễn Văn B" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RenterPayload;
    expect(body.name).toBe("Nguyễn Văn B");
    expect(body.phone).toBe("84901234567");
    expect(body.idNumber).toBe("079088012345");
  });

  test("an empty body changes nothing", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const renter = await createRenter(a.cookie, motel.id, { idNumber: "079088012345" });

    const res = await api("PATCH", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
      body: {},
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RenterPayload;
    expect(body.name).toBe("Nguyễn Văn A");
    expect(body.idNumber).toBe("079088012345");
  });

  test("an explicit null clears the CCCD and the room", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const room = await createRoom(a.cookie, motel.id);
    const renter = await createRenter(a.cookie, motel.id, {
      roomId: room.id,
      idNumber: "079088012345",
    });

    const res = await api("PATCH", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
      body: { roomId: null, idNumber: null },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RenterPayload;
    expect(body.roomId).toBeNull();
    expect(body.idNumber).toBeNull();
  });

  test("reassigns the renter to another room of the same motel", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const first = await createRoom(a.cookie, motel.id, { name: "P.101" });
    const second = await createRoom(a.cookie, motel.id, { name: "P.102" });
    const renter = await createRenter(a.cookie, motel.id, { roomId: first.id });

    const res = await api("PATCH", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
      body: { roomId: second.id },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as RenterPayload).roomId).toBe(second.id);
    const [stored] = await db.select({ roomId: renters.roomId }).from(renters);
    expect(stored!.roomId).toBe(second.id);
    const roomRows = await db.select({ id: rooms.id, status: rooms.status }).from(rooms);
    expect(roomRows.find((room) => room.id === first.id)?.status).toBe("available");
    expect(roomRows.find((room) => room.id === second.id)?.status).toBe("occupied");
  });

  test("assigning and unassigning updates room occupancy automatically", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const room = await createRoom(a.cookie, motel.id);
    const renter = await createRenter(a.cookie, motel.id, { roomId: room.id });

    let [stored] = await db.select({ status: rooms.status }).from(rooms);
    expect(stored!.status).toBe("occupied");

    const res = await api("PATCH", `/manager/motels/${motel.id}/renters/${renter.id}`, { cookie: a.cookie, body: { roomId: null } });
    expect(res.status).toBe(200);
    [stored] = await db.select({ status: rooms.status }).from(rooms);
    expect(stored!.status).toBe("available");
  });

  test("automatic occupancy does not overwrite maintenance", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const room = await createRoom(a.cookie, motel.id, { status: "maintenance" });
    await createRenter(a.cookie, motel.id, { roomId: room.id });
    const [stored] = await db.select({ status: rooms.status }).from(rooms);
    expect(stored!.status).toBe("maintenance");
  });

  test("404 for a room in another motel, and the stored room is untouched", async () => {
    const a = await login("a@example.com");
    const mine = await createMotel(a.cookie, "Của A");
    const other = await createMotel(a.cookie, "Nhà trọ khác");
    const own = await createRoom(a.cookie, mine.id, { name: "P.101" });
    const foreignRoom = await createRoom(a.cookie, other.id, { name: "P.201" });
    const renter = await createRenter(a.cookie, mine.id, { roomId: own.id });

    const res = await api("PATCH", `/manager/motels/${mine.id}/renters/${renter.id}`, {
      cookie: a.cookie,
      body: { roomId: foreignRoom.id },
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorPayload).code).toBe("NOT_FOUND");
    const [stored] = await db.select({ roomId: renters.roomId }).from(renters);
    expect(stored!.roomId).toBe(own.id);
  });

  test("404 for another manager's room, and the stored room is untouched", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const mine = await createMotel(a.cookie, "Của A");
    const own = await createRoom(a.cookie, mine.id, { name: "P.101" });
    const theirMotel = await createMotel(b.cookie, "Của B");
    const foreignRoom = await createRoom(b.cookie, theirMotel.id, { name: "P.201" });
    const renter = await createRenter(a.cookie, mine.id, { roomId: own.id });

    const res = await api("PATCH", `/manager/motels/${mine.id}/renters/${renter.id}`, {
      cookie: a.cookie,
      body: { roomId: foreignRoom.id },
    });
    expect(res.status).toBe(404);
    const [stored] = await db.select({ roomId: renters.roomId }).from(renters);
    expect(stored!.roomId).toBe(own.id);
  });

  test("409 on changing the phone to another renter's phone in the same motel", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    await createRenter(a.cookie, motel.id, { phone: "0901234567" });
    const second = await createRenter(a.cookie, motel.id, { name: "B", phone: "0907654321" });

    const res = await api("PATCH", `/manager/motels/${motel.id}/renters/${second.id}`, {
      cookie: a.cookie,
      body: { phone: "0901234567" },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorPayload;
    expect(body.code).toBe("CONFLICT");
    expect(body.error).toContain("84901234567");
    // Neither row moved: the refused write left the phone of both renters alone.
    const stored = await db.select({ phone: renters.phone }).from(renters);
    expect(stored.map((row) => row.phone).sort()).toEqual(["84901234567", "84907654321"]);
  });

  test("re-saving a renter's own phone is not a conflict", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const renter = await createRenter(a.cookie, motel.id, { phone: "0901234567" });

    const res = await api("PATCH", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
      body: { phone: "0901234567" },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as RenterPayload).phone).toBe("84901234567");
  });

  test("changing the phone to one used in another motel is fine", async () => {
    const a = await login("a@example.com");
    const first = await createMotel(a.cookie, "Nhà trọ một");
    const second = await createMotel(a.cookie, "Nhà trọ hai");
    await createRenter(a.cookie, first.id, { phone: "0901234567" });
    const mine = await createRenter(a.cookie, second.id, { name: "B", phone: "0907654321" });

    const res = await api("PATCH", `/manager/motels/${second.id}/renters/${mine.id}`, {
      cookie: a.cookie,
      body: { phone: "0901234567" },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as RenterPayload).phone).toBe("84901234567");
  });

  test("rejects a malformed phone with 400 and leaves the stored phone intact", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const renter = await createRenter(a.cookie, motel.id);

    const res = await api("PATCH", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
      body: { phone: "12345" },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    const [stored] = await db.select({ phone: renters.phone }).from(renters);
    expect(stored!.phone).toBe("84901234567");
  });

  test("rejects an unknown status with 400 and leaves the stored status intact", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const renter = await createRenter(a.cookie, motel.id);

    const res = await api("PATCH", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
      body: { status: "vacant" },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    const [stored] = await db.select({ status: renters.status }).from(renters);
    expect(stored!.status).toBe("active");
  });

  test("another manager's renter is 404 and is not modified", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const foreign = await createMotel(b.cookie, "Của B");
    const renter = await seedRenter(foreign.id);

    const res = await api("PATCH", `/manager/motels/${foreign.id}/renters/${renter.id}`, {
      cookie: a.cookie,
      body: { name: "Bị đổi" },
    });
    expect(res.status).toBe(404);
    const [stored] = await db.select({ name: renters.name }).from(renters);
    expect(stored!.name).toBe("Nguyễn Văn A");
  });

  test("the caller's renter under a different motel is 404 and is not modified", async () => {
    const a = await login("a@example.com");
    const first = await createMotel(a.cookie, "Nhà trọ một");
    const second = await createMotel(a.cookie, "Nhà trọ hai");
    const renter = await createRenter(a.cookie, second.id);

    const res = await api("PATCH", `/manager/motels/${first.id}/renters/${renter.id}`, {
      cookie: a.cookie,
      body: { name: "Bị đổi" },
    });
    expect(res.status).toBe(404);
    const [stored] = await db.select({ name: renters.name }).from(renters);
    expect(stored!.name).toBe("Nguyễn Văn A");
  });

  test("401 without a manager session", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const renter = await createRenter(a.cookie, motel.id);

    const res = await api("PATCH", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      body: { name: "Bị đổi" },
    });
    expect(res.status).toBe(401);
    const [stored] = await db.select({ name: renters.name }).from(renters);
    expect(stored!.name).toBe("Nguyễn Văn A");
  });
});

describe("DELETE /api/manager/motels/:motelId/renters/:renterId", () => {
  test("204 and the row survives as inactive", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const renter = await createRenter(a.cookie, motel.id);

    const res = await api("DELETE", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(204);
    expect(await db.$count(renters)).toBe(1);
    const [stored] = await db.select({ status: renters.status }).from(renters);
    expect(stored!.status).toBe("inactive");
  });

  test("the contract and the invoices survive the soft delete", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const room = await createRoom(a.cookie, motel.id);
    const renter = await createRenter(a.cookie, motel.id, { roomId: room.id });
    await seedContract(renter.id, room.id, motel.id);
    await seedInvoice(renter.id, room.id, motel.id, 1, { paymentStatus: "paid" });

    const res = await api("DELETE", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(204);
    expect(await db.$count(contracts)).toBe(1);
    expect(await db.$count(invoices)).toBe(1);

    // And the financial history is still readable through the renter.
    const detail = await api("GET", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
    });
    const body = (await detail.json()) as RenterDetailPayload;
    expect(body.status).toBe("inactive");
    expect(body.activeContract).not.toBeNull();
    expect(body.invoices).toHaveLength(1);
    expect(body.invoices[0]!.paymentStatus).toBe("paid");
  });

  test("204 again when the renter is already inactive", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const renter = await seedRenter(motel.id, { status: "inactive" });

    const res = await api("DELETE", `/manager/motels/${motel.id}/renters/${renter.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(204);
    expect(await db.$count(renters)).toBe(1);
  });

  test("404 for another manager's renter, and the status is untouched", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const foreign = await createMotel(b.cookie, "Của B");
    const renter = await seedRenter(foreign.id);

    const res = await api("DELETE", `/manager/motels/${foreign.id}/renters/${renter.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorPayload).code).toBe("NOT_FOUND");
    const [stored] = await db.select({ status: renters.status }).from(renters);
    expect(stored!.status).toBe("active");
  });

  test("the caller's renter under a different motel is 404 and stays active", async () => {
    const a = await login("a@example.com");
    const first = await createMotel(a.cookie, "Nhà trọ một");
    const second = await createMotel(a.cookie, "Nhà trọ hai");
    const renter = await createRenter(a.cookie, second.id);

    const res = await api("DELETE", `/manager/motels/${first.id}/renters/${renter.id}`, {
      cookie: a.cookie,
    });
    expect(res.status).toBe(404);
    const [stored] = await db.select({ status: renters.status }).from(renters);
    expect(stored!.status).toBe("active");
  });

  test("401 without a manager session", async () => {
    const a = await login("a@example.com");
    const motel = await createMotel(a.cookie);
    const renter = await createRenter(a.cookie, motel.id);

    const res = await api("DELETE", `/manager/motels/${motel.id}/renters/${renter.id}`);
    expect(res.status).toBe(401);
    const [stored] = await db.select({ status: renters.status }).from(renters);
    expect(stored!.status).toBe("active");
  });
});