import { beforeEach, describe, expect, test } from "bun:test";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { billingPeriods } from "@/modules/billing/billing.schema";
import { contractTemplates } from "@/modules/contract/contract.schema";

beforeEach(resetDb);

const PASSWORD = "aaaaaaaaaa";

interface MotelPayload {
  id: string;
  managerId: string;
  name: string;
  address: string | null;
  electricityPrice: string;
  waterPrice: string;
  otherFees: { name: string; amount: string }[];
  bankAccount: { bankCode: string; accountNumber: string; accountName: string } | null;
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

async function createMotel(
  cookie: string,
  overrides: Record<string, unknown> = {},
): Promise<MotelPayload> {
  const res = await api("POST", "/manager/motels", {
    cookie,
    body: { name: "Nhà trọ", electricityPrice: "3500", waterPrice: "25000", ...overrides },
  });
  expect(res.status).toBe(201);
  return (await res.json()) as MotelPayload;
}

function seedMotel(managerId: string, name = "Nhà trọ") {
  return db
    .insert(motels)
    .values({ managerId, name, electricityPrice: "3500", waterPrice: "25000" })
    .returning()
    .then(([row]) => row!);
}

describe("GET /api/manager/motels", () => {
  test("returns only the caller's motels", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const first = await createMotel(a.cookie, { name: "Của A" });
    const second = await createMotel(a.cookie, { name: "Của A nữa" });
    const foreign = await createMotel(b.cookie, { name: "Của B" });

    const res = await api("GET", "/manager/motels", { cookie: a.cookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as MotelPayload[];
    const ids = body.map((m) => m.id);
    expect(ids.sort()).toEqual([first.id, second.id].sort());
    expect(ids).not.toContain(foreign.id);
    expect(body.every((m) => m.managerId === a.manager.id)).toBe(true);
  });

  test("serialises prices as VND digit strings, never numbers", async () => {
    const a = await login("a@example.com");
    await createMotel(a.cookie, { otherFees: [{ name: "Rác", amount: "20000" }] });

    const res = await api("GET", "/manager/motels", { cookie: a.cookie });
    const body = (await res.json()) as MotelPayload[];
    expect(typeof body[0]!.electricityPrice).toBe("string");
    expect(typeof body[0]!.waterPrice).toBe("string");
    expect(body[0]!.electricityPrice).toBe("3500");
    expect(body[0]!.waterPrice).toBe("25000");
    expect(typeof body[0]!.otherFees[0]!.amount).toBe("string");
  });

  test("401 without a manager session", async () => {
    const res = await api("GET", "/manager/motels");
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorPayload).code).toBe("UNAUTHORIZED");
  });
});

describe("POST /api/manager/motels", () => {
  test("creates a motel and returns 201", async () => {
    const a = await login("a@example.com");
    const body = await createMotel(a.cookie, {
      name: "Nhà trọ Minh",
      address: "12 Nguyễn Huệ",
      otherFees: [{ name: "Rác", amount: "20000" }],
      bankAccount: {
        bankCode: "970422",
        accountNumber: "1234567890",
        accountName: "NGUYEN VAN A",
      },
    });

    expect(body.name).toBe("Nhà trọ Minh");
    expect(body.address).toBe("12 Nguyễn Huệ");
    expect(body.electricityPrice).toBe("3500");
    expect(body.otherFees).toEqual([{ name: "Rác", amount: "20000" }]);
    expect(body.bankAccount?.bankCode).toBe("970422");
  });

  test("rejects a missing electricityPrice with 400 VALIDATION_ERROR", async () => {
    const a = await login("a@example.com");
    const res = await api("POST", "/manager/motels", {
      cookie: a.cookie,
      body: { name: "Nhà trọ", waterPrice: "25000" },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
  });

  test("rejects a missing waterPrice with 400 VALIDATION_ERROR", async () => {
    const a = await login("a@example.com");
    const res = await api("POST", "/manager/motels", {
      cookie: a.cookie,
      body: { name: "Nhà trọ", electricityPrice: "3500" },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
  });

  test("rejects a non-digit price with 400 and stores nothing", async () => {
    const a = await login("a@example.com");
    const res = await api("POST", "/manager/motels", {
      cookie: a.cookie,
      body: { name: "Nhà trọ", electricityPrice: "ba nghìn năm", waterPrice: "25000" },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
    expect(await db.$count(motels)).toBe(0);
  });

  test("rejects a decimal price with 400 — a float never becomes a number", async () => {
    const a = await login("a@example.com");
    const res = await api("POST", "/manager/motels", {
      cookie: a.cookie,
      body: { name: "Nhà trọ", electricityPrice: "3500.5", waterPrice: "25000" },
    });
    expect(res.status).toBe(400);
    expect(await db.$count(motels)).toBe(0);
  });

  test("rejects a non-digit amount inside otherFees with 400", async () => {
    const a = await login("a@example.com");
    const res = await api("POST", "/manager/motels", {
      cookie: a.cookie,
      body: {
        name: "Nhà trọ",
        electricityPrice: "3500",
        waterPrice: "25000",
        otherFees: [{ name: "Rác", amount: "20k" }],
      },
    });
    expect(res.status).toBe(400);
    expect(await db.$count(motels)).toBe(0);
  });

  test("a managerId in the body cannot move a motel to another tenant", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");

    const body = await createMotel(a.cookie, { managerId: b.manager.id });
    expect(body.managerId).not.toBe(b.manager.id);
    const [stored] = await db.select({ managerId: motels.managerId }).from(motels);
    expect(stored!.managerId).toBe(a.manager.id);
  });

  test("401 without a manager session", async () => {
    const res = await api("POST", "/manager/motels", {
      body: { name: "Nhà trọ", electricityPrice: "3500", waterPrice: "25000" },
    });
    expect(res.status).toBe(401);
    expect(await db.$count(motels)).toBe(0);
  });
});

describe("GET /api/manager/motels/:motelId", () => {
  test("returns the caller's motel with digit-string prices", async () => {
    const a = await login("a@example.com");
    const created = await createMotel(a.cookie);

    const res = await api("GET", `/manager/motels/${created.id}`, { cookie: a.cookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as MotelPayload;
    expect(body.id).toBe(created.id);
    expect(body.electricityPrice).toBe("3500");
    expect(body.otherFees).toEqual([]);
    expect(body.bankAccount).toBeNull();
  });

  test("another manager's motel is 404, never 403", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const foreign = await seedMotel(b.manager.id, "Của B");

    const res = await api("GET", `/manager/motels/${foreign.id}`, { cookie: a.cookie });
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorPayload).code).toBe("NOT_FOUND");
  });

  test("a motel that does not exist is also 404", async () => {
    const a = await login("a@example.com");
    const res = await api("GET", "/manager/motels/00000000-0000-4000-8000-00000000dead", {
      cookie: a.cookie,
    });
    expect(res.status).toBe(404);
  });

  test("a malformed id is 400, not a 500 from the uuid column", async () => {
    const a = await login("a@example.com");
    const res = await api("GET", "/manager/motels/khong-phai-uuid", { cookie: a.cookie });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");
  });
});

describe("PATCH /api/manager/motels/:motelId", () => {
  test("updates address, prices, otherFees and bankAccount", async () => {
    const a = await login("a@example.com");
    const created = await createMotel(a.cookie, { otherFees: [{ name: "Rác", amount: "20000" }] });

    const res = await api("PATCH", `/manager/motels/${created.id}`, {
      cookie: a.cookie,
      body: {
        address: "34 Lê Lợi, Q1",
        electricityPrice: "4000",
        waterPrice: "30000",
        otherFees: [
          { name: "Rác", amount: "25000" },
          { name: "Internet", amount: "100000" },
        ],
        bankAccount: {
          bankCode: "970422",
          accountNumber: "1234567890",
          accountName: "NGUYEN VAN A",
        },
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as MotelPayload;
    expect(body.address).toBe("34 Lê Lợi, Q1");
    expect(body.electricityPrice).toBe("4000");
    expect(body.waterPrice).toBe("30000");
    expect(body.otherFees).toEqual([
      { name: "Rác", amount: "25000" },
      { name: "Internet", amount: "100000" },
    ]);
    expect(body.bankAccount?.accountName).toBe("NGUYEN VAN A");
  });

  test("leaves fields absent from the body alone", async () => {
    const a = await login("a@example.com");
    const created = await createMotel(a.cookie, {
      name: "Tên gốc",
      otherFees: [{ name: "Rác", amount: "20000" }],
      bankAccount: {
        bankCode: "970422",
        accountNumber: "1234567890",
        accountName: "NGUYEN VAN A",
      },
    });

    const res = await api("PATCH", `/manager/motels/${created.id}`, {
      cookie: a.cookie,
      body: { address: "34 Lê Lợi, Q1" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as MotelPayload;
    expect(body.address).toBe("34 Lê Lợi, Q1");
    expect(body.name).toBe("Tên gốc");
    expect(body.electricityPrice).toBe("3500");
    expect(body.waterPrice).toBe("25000");
    expect(body.otherFees).toEqual([{ name: "Rác", amount: "20000" }]);
    expect(body.bankAccount?.accountNumber).toBe("1234567890");
  });

  test("an empty body changes nothing", async () => {
    const a = await login("a@example.com");
    const created = await createMotel(a.cookie, {
      address: "12 Nguyễn Huệ",
      otherFees: [{ name: "Rác", amount: "20000" }],
    });

    const res = await api("PATCH", `/manager/motels/${created.id}`, {
      cookie: a.cookie,
      body: {},
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as MotelPayload;
    expect(body.address).toBe("12 Nguyễn Huệ");
    expect(body.electricityPrice).toBe("3500");
    expect(body.otherFees).toEqual([{ name: "Rác", amount: "20000" }]);
  });

  test("an explicit empty otherFees array clears the fees", async () => {
    const a = await login("a@example.com");
    const created = await createMotel(a.cookie, { otherFees: [{ name: "Rác", amount: "20000" }] });

    const res = await api("PATCH", `/manager/motels/${created.id}`, {
      cookie: a.cookie,
      body: { otherFees: [] },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as MotelPayload).otherFees).toEqual([]);
  });

  test("an explicit null bankAccount clears the bank account", async () => {
    const a = await login("a@example.com");
    const created = await createMotel(a.cookie, {
      bankAccount: {
        bankCode: "970422",
        accountNumber: "1234567890",
        accountName: "NGUYEN VAN A",
      },
    });

    const res = await api("PATCH", `/manager/motels/${created.id}`, {
      cookie: a.cookie,
      body: { bankAccount: null },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as MotelPayload).bankAccount).toBeNull();
  });

  test("rejects a non-digit price with 400 and leaves the stored price intact", async () => {
    const a = await login("a@example.com");
    const created = await createMotel(a.cookie);

    const res = await api("PATCH", `/manager/motels/${created.id}`, {
      cookie: a.cookie,
      body: { electricityPrice: "3500.5" },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorPayload).code).toBe("VALIDATION_ERROR");

    const after = await api("GET", `/manager/motels/${created.id}`, { cookie: a.cookie });
    expect(((await after.json()) as MotelPayload).electricityPrice).toBe("3500");
  });

  test("another manager's motel is 404 and is not modified", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const foreign = await seedMotel(b.manager.id, "Của B");

    const res = await api("PATCH", `/manager/motels/${foreign.id}`, {
      cookie: a.cookie,
      body: { name: "Bị đổi" },
    });
    expect(res.status).toBe(404);
    const [stored] = await db.select({ name: motels.name }).from(motels);
    expect(stored!.name).toBe("Của B");
  });
});

describe("DELETE /api/manager/motels/:motelId", () => {
  test("204 and the row is gone when the motel is completely empty", async () => {
    const a = await login("a@example.com");
    const created = await createMotel(a.cookie);

    const res = await api("DELETE", `/manager/motels/${created.id}`, { cookie: a.cookie });
    expect(res.status).toBe(204);
    expect(await db.$count(motels)).toBe(0);
  });

  test("409 CONFLICT when a room is occupied, and the message says so", async () => {
    const a = await login("a@example.com");
    const created = await createMotel(a.cookie);
    await db.insert(rooms).values([
      { motelId: created.id, name: "P.101", status: "available" },
      { motelId: created.id, name: "P.102", status: "occupied" },
    ]);

    const res = await api("DELETE", `/manager/motels/${created.id}`, { cookie: a.cookie });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorPayload;
    expect(body.code).toBe("CONFLICT");
    // The message names the occupied state, not just "there are rooms".
    expect(body.error).toContain("đang có người thuê");
    expect(await db.$count(motels)).toBe(1);
  });

  test("409 CONFLICT when the only rooms are available or maintenance", async () => {
    const a = await login("a@example.com");
    const created = await createMotel(a.cookie);
    await db.insert(rooms).values([
      { motelId: created.id, name: "P.101", status: "available" },
      { motelId: created.id, name: "P.102", status: "maintenance" },
    ]);

    const res = await api("DELETE", `/manager/motels/${created.id}`, { cookie: a.cookie });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorPayload;
    expect(body.code).toBe("CONFLICT");
    expect(body.error).toContain("2 phòng");
    expect(body.error).not.toContain("đang có người thuê");
    expect(await db.$count(motels)).toBe(1);
  });

  test("409 CONFLICT when a renter exists and there are no rooms", async () => {
    const a = await login("a@example.com");
    const created = await createMotel(a.cookie);
    await db.insert(renters).values({
      motelId: created.id,
      name: "Nguyễn Văn A",
      phone: "84901234567",
    });

    const res = await api("DELETE", `/manager/motels/${created.id}`, { cookie: a.cookie });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorPayload;
    expect(body.code).toBe("CONFLICT");
    expect(body.error).toContain("người thuê");
    expect(await db.$count(motels)).toBe(1);
  });

  test("409 CONFLICT when a billing period exists", async () => {
    const a = await login("a@example.com");
    const created = await createMotel(a.cookie);
    await db.insert(billingPeriods).values({ motelId: created.id, month: 10, year: 2026 });

    const res = await api("DELETE", `/manager/motels/${created.id}`, { cookie: a.cookie });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorPayload;
    expect(body.code).toBe("CONFLICT");
    expect(body.error).toContain("kỳ thanh toán");
    expect(await db.$count(motels)).toBe(1);
  });

  test("409 CONFLICT when a contract template exists", async () => {
    const a = await login("a@example.com");
    const created = await createMotel(a.cookie);
    await db.insert(contractTemplates).values({
      motelId: created.id,
      name: "Hợp đồng mẫu",
      clauses: [{ title: "Tiền thuê", content: "Thuê hàng tháng." }],
    });

    const res = await api("DELETE", `/manager/motels/${created.id}`, { cookie: a.cookie });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorPayload;
    expect(body.code).toBe("CONFLICT");
    expect(body.error).toContain("mẫu hợp đồng");
    expect(await db.$count(motels)).toBe(1);
  });

  test("404 for another manager's motel, and the motel survives", async () => {
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const foreign = await seedMotel(b.manager.id, "Của B");

    const res = await api("DELETE", `/manager/motels/${foreign.id}`, { cookie: a.cookie });
    expect(res.status).toBe(404);
    expect(await db.$count(motels)).toBe(1);
  });
});