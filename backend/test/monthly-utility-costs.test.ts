import { beforeEach, expect, test } from "bun:test";
import { resetRateLimits } from "@/shared/rate-limit";
import { randomInt } from "node:crypto";
import { env } from "@/config";
import { issueMagicLink } from "@/shared/magic-link";
import { managers } from "@/modules/auth/auth.schema";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { billingPeriods, invoices, monthlyUtilityCosts } from "@/modules/billing/billing.schema";
import { paymentProofs } from "@/modules/payment/payment.schema";
import { motels, motels as motelTable } from "@/modules/motel/motel.schema";
import { rooms as roomTable } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { eq } from "drizzle-orm";

beforeEach(async () => {
  resetRateLimits();
  await resetDb();
});

async function manager(email: string) {
  email = `${email.split("@")[0]}-${randomInt(1_000_000)}@example.com`;
  await registerManager({ email, password: "aaaaaaaaaa", name: email });
  const response = await app.handle(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "aaaaaaaaaa" }),
    }),
  );
  expect(response.status).toBe(200);
  const account = await db.query.managers.findFirst({
    where: (row, { eq }) => eq(row.email, email),
  });
  return { cookie: response.headers.get("set-cookie") ?? "", id: account!.id };
}

async function renter(motelId: string, roomId: string, suffix: number) {
  return (
    await db
      .insert(renters)
      .values({
        motelId,
        roomId,
        name: `Renter ${suffix}`,
        phone: `84${String(suffix).padStart(9, "0")}`,
      })
      .returning()
  )[0]!;
}

async function createMotel(managerId: string) {
  const [motel] = await db
    .insert(motels)
    .values({ managerId, name: "Motel", electricityPrice: "2000", waterPrice: "15000" })
    .returning();
  return motel!;
}

function report(cookie: string, motelId: string, month = "10", year = "2026") {
  return app.handle(
    new Request(
      `http://localhost/api/manager/motels/${motelId}/billing/months/${year}/${month}/report`,
      { headers: { Cookie: cookie } },
    ),
  );
}

function save(cookie: string, motelId: string, body: unknown, month = "10", year = "2026") {
  return app.handle(
    new Request(
      `http://localhost/api/manager/motels/${motelId}/billing/months/${year}/${month}/utility-costs`,
      {
        method: "PUT",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ),
  );
}

async function login(email: string, password: string) {
  const response = await app.handle(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  return { response, cookie: response.headers.get("set-cookie") ?? "" };
}

const complete = (
  electricityAmount: string | null,
  waterAmount: string | null,
  electricityNotes: string | null = null,
  waterNotes: string | null = null,
) => ({ electricityAmount, waterAmount, electricityNotes, waterNotes });

test("stores costs without a billing period; distinguishes null and zero and normalizes notes", async () => {
  const owner = await manager("cost-owner@example.com");
  const motel = await createMotel(owner.id);
  const response = await save(owner.cookie, motel.id, complete("0", null, "  paid  ", "   "));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    motelId: motel.id,
    year: 2026,
    month: 10,
    ...complete("0", null, "paid", null),
  });
  expect(await db.select().from(billingPeriods)).toHaveLength(0);
});

test("replaces and clears costs, including after period closure, without changing invoices", async () => {
  const owner = await manager("cost-close@example.com");
  const motel = await createMotel(owner.id);
  const [period] = await db
    .insert(billingPeriods)
    .values({ motelId: motel.id, month: 10, year: 2026, status: "closed" })
    .returning();
  const first = await save(owner.cookie, motel.id, complete("100", "200"));
  expect(first.status).toBe(200);
  const second = await save(owner.cookie, motel.id, complete(null, "0"));
  expect(second.status).toBe(200);
  expect(await second.json()).toMatchObject(complete(null, "0"));
  expect(await db.select().from(invoices)).toHaveLength(0);
  expect((await db.select().from(billingPeriods))[0]).toMatchObject({
    id: period!.id,
    status: "closed",
  });
});

test("concurrent upserts retain exactly one monthly record", async () => {
  const owner = await manager("cost-race@example.com");
  const motel = await createMotel(owner.id);
  const responses = await Promise.all([
    save(owner.cookie, motel.id, complete("100", null)),
    save(owner.cookie, motel.id, complete(null, "200")),
  ]);
  expect(responses.map((response) => response.status)).toEqual([200, 200]);
  expect(await db.select().from(monthlyUtilityCosts)).toHaveLength(1);
});

test("hides foreign motels and denies renter and unauthenticated writes", async () => {
  const owner = await manager("cost-owner-a@example.com");
  const other = await manager("cost-owner-b@example.com");
  const motel = await createMotel(owner.id);
  expect((await save(other.cookie, motel.id, complete("1", "1"))).status).toBe(404);
  expect((await save("", motel.id, complete("1", "1"))).status).toBe(401);
  expect(await db.select().from(monthlyUtilityCosts)).toHaveLength(0);
});

test("rejects malformed motel UUID, negative and overflow amounts", async () => {
  const owner = await manager("cost-boundary@example.com");
  const motel = await createMotel(owner.id);
  expect((await save(owner.cookie, "not-a-uuid", complete("1", "1"))).status).toBe(400);
  expect((await save(owner.cookie, motel.id, complete("-1", "1"))).status).toBe(400);
  expect((await save(owner.cookie, motel.id, complete("100000000000000", "1"))).status).toBe(400);
  expect(await db.select().from(monthlyUtilityCosts)).toHaveLength(0);
});

test("allows superadmin and denies renter for report and cost write", async () => {
  const owner = await manager("cost-superadmin-owner@example.com");
  const motel = await createMotel(owner.id);
  const rootPassword = "secure test root password";
  const [root] = await db
    .insert(managers)
    .values({
      email: `root-${randomInt(1_000_000)}@example.com`,
      passwordHash: await Bun.password.hash(rootPassword, { algorithm: "argon2id" }),
      name: "Root",
      role: "superadmin",
    })
    .returning();
  const { response: rootLogin, cookie: rootCookie } = await login(root!.email, rootPassword);
  expect(rootLogin.status).toBe(200);
  expect((await report(rootCookie, motel.id)).status).toBe(200);
  expect((await save(rootCookie, motel.id, complete("0", null))).status).toBe(200);

  const room = (
    await db.insert(roomTable).values({ motelId: motel.id, name: "renter-auth" }).returning()
  )[0]!;
  const renterRow = await renter(motel.id, room.id, 99);
  const { token } = await issueMagicLink(renterRow.id);
  const exchange = await app.handle(
    new Request("http://localhost/api/renter/magic-links/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }),
  );
  expect(exchange.status).toBe(200);
  const renterCookie = exchange.headers.get("set-cookie") ?? "";
  expect((await report(renterCookie, motel.id)).status).toBe(401);
  expect((await save(renterCookie, motel.id, complete("1", "1"))).status).toBe(401);
});

test("rejects invalid month, year, malformed amount, and incomplete replacement", async () => {
  const owner = await manager("cost-invalid@example.com");
  const motel = await createMotel(owner.id);
  const invalidCases: Array<[string, string, unknown]> = [
    ["13", "2026", complete("1", "1")],
    ["10", "10000", complete("1", "1")],
    ["10", "2026", complete("1.2", "1")],
    ["10", "2026", { electricityAmount: "1" }],
  ];
  for (const [month, year, body] of invalidCases) {
    expect((await save(owner.cookie, motel.id, body, month, year)).status).toBe(400);
  }
  expect(await db.select().from(monthlyUtilityCosts)).toHaveLength(0);
});

test("reports finalized invoice snapshots, exact payments, costs once, and period status", async () => {
  const owner = await manager("report-owner@example.com");
  const motel = await createMotel(owner.id);
  const [sent] = await db
    .insert(billingPeriods)
    .values({ motelId: motel.id, month: 10, year: 2026, status: "sent" })
    .returning();
  const room1 = (
    await db.insert(roomTable).values({ motelId: motel.id, name: "101" }).returning()
  )[0]!;
  const room2 = (
    await db.insert(roomTable).values({ motelId: motel.id, name: "102" }).returning()
  )[0]!;
  const renter1 = await renter(motel.id, room1.id, 1);
  const renter2 = await renter(motel.id, room2.id, 2);
  await db.insert(invoices).values([
    {
      billingPeriodId: sent!.id,
      motelId: motel.id,
      roomId: room1.id,
      renterId: renter1.id,
      rentAmount: "8000",
      electricityUsage: "1",
      electricityCost: "1000",
      waterUsage: "1",
      waterCost: "500",
      totalAmount: "10000",
      paymentStatus: "paid",
    },
    {
      billingPeriodId: sent!.id,
      motelId: motel.id,
      roomId: room2.id,
      renterId: renter2.id,
      rentAmount: "6000",
      electricityUsage: "1",
      electricityCost: "600",
      waterUsage: "1",
      waterCost: "400",
      totalAmount: "6000",
      paymentStatus: "unpaid",
    },
  ]);
  await save(owner.cookie, motel.id, complete("600", "200"));
  const response = await report(owner.cookie, motel.id);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    motelId: motel.id,
    year: 2026,
    month: 10,
    periodStatus: "sent",
    costs: complete("600", "200"),
    electricity: {
      billed: "1600",
      collected: "1000",
      cost: "600",
      billedDifference: "1000",
      collectedDifference: "400",
    },
    water: {
      billed: "900",
      collected: "500",
      cost: "200",
      billedDifference: "700",
      collectedDifference: "300",
    },
    utilities: {
      billed: "2500",
      collected: "1500",
      cost: "800",
      billedDifference: "1700",
      collectedDifference: "700",
    },
    totals: {
      billed: "16000",
      collected: "10000",
      outstanding: "6000",
      billedLessUtilityCosts: "15200",
      collectedLessUtilityCosts: "9200",
    },
  });
});

test("excludes drafts, pending proofs, and foreign motel invoices; handles absent and missing costs", async () => {
  const owner = await manager("report-exclusion@example.com");
  const stranger = await manager("report-stranger@example.com");
  const motel = await createMotel(owner.id);
  const foreign = await createMotel(stranger.id);
  const [draft] = await db
    .insert(billingPeriods)
    .values({ motelId: motel.id, month: 10, year: 2026, status: "draft" })
    .returning();
  const [sent] = await db
    .insert(billingPeriods)
    .values({ motelId: motel.id, month: 9, year: 2026, status: "sent" })
    .returning();
  const [foreignPeriod] = await db
    .insert(billingPeriods)
    .values({ motelId: foreign.id, month: 10, year: 2026, status: "sent" })
    .returning();
  const invoiceId = crypto.randomUUID();
  const roomId = (
    await db.insert(roomTable).values({ motelId: motel.id, name: "201" }).returning()
  )[0]!;
  const roomId2 = (
    await db.insert(roomTable).values({ motelId: motel.id, name: "202" }).returning()
  )[0]!;
  const foreignRoomId = (
    await db.insert(roomTable).values({ motelId: foreign.id, name: "201" }).returning()
  )[0]!;
  const draftRenter = await renter(motel.id, roomId.id, 3);
  const sentRenter = await renter(motel.id, roomId2.id, 4);
  const foreignRenter = await renter(foreign.id, foreignRoomId.id, 5);
  await db.insert(invoices).values([
    {
      id: invoiceId,
      billingPeriodId: draft!.id,
      motelId: motel.id,
      roomId: roomId.id,
      renterId: draftRenter.id,
      rentAmount: "100",
      electricityUsage: "0",
      electricityCost: "90",
      waterUsage: "0",
      waterCost: "10",
      totalAmount: "100",
      paymentStatus: "paid",
    },
    {
      billingPeriodId: sent!.id,
      motelId: motel.id,
      roomId: roomId2.id,
      renterId: sentRenter.id,
      rentAmount: "100",
      electricityUsage: "0",
      electricityCost: "90",
      waterUsage: "0",
      waterCost: "10",
      totalAmount: "100",
      paymentStatus: "overdue",
    },
    {
      billingPeriodId: foreignPeriod!.id,
      motelId: foreign.id,
      roomId: foreignRoomId.id,
      renterId: foreignRenter.id,
      rentAmount: "999",
      electricityUsage: "0",
      electricityCost: "999",
      waterUsage: "0",
      waterCost: "0",
      totalAmount: "999",
      paymentStatus: "paid",
    },
  ]);
  await db.insert(paymentProofs).values({
    invoiceId,
    renterId: draftRenter.id,
    motelId: motel.id,
    objectKey: "pending",
    contentType: "image/png",
    size: 10,
    checksum: "abc",
  });
  const response = await report(owner.cookie, motel.id);
  expect(await response.json()).toEqual({
    motelId: motel.id,
    year: 2026,
    month: 10,
    periodStatus: "draft",
    costs: complete(null, null),
    electricity: {
      billed: "0",
      collected: "0",
      cost: null,
      billedDifference: null,
      collectedDifference: null,
    },
    water: {
      billed: "0",
      collected: "0",
      cost: null,
      billedDifference: null,
      collectedDifference: null,
    },
    utilities: {
      billed: "0",
      collected: "0",
      cost: null,
      billedDifference: null,
      collectedDifference: null,
    },
    totals: {
      billed: "0",
      collected: "0",
      outstanding: "0",
      billedLessUtilityCosts: null,
      collectedLessUtilityCosts: null,
    },
  });
  const absent = await report(owner.cookie, motel.id, "11");
  expect(((await absent.json()) as { periodStatus: string | null }).periodStatus).toBeNull();
  expect((await report(stranger.cookie, motel.id)).status).toBe(404);
});

test("uses tariff snapshots, original invoice month, explicit zero and exact large signed totals", async () => {
  const owner = await manager("report-exact@example.com");
  const motel = await createMotel(owner.id);
  const [period] = await db
    .insert(billingPeriods)
    .values({ motelId: motel.id, month: 10, year: 2026, status: "closed" })
    .returning();
  const roomId = (
    await db.insert(roomTable).values({ motelId: motel.id, name: "301" }).returning()
  )[0]!;
  const renterRow = await renter(motel.id, roomId.id, 6);
  const room2 = (
    await db.insert(roomTable).values({ motelId: motel.id, name: "302" }).returning()
  )[0]!;
  const renterRow2 = await renter(motel.id, room2.id, 7);
  await db.insert(invoices).values([
    {
      billingPeriodId: period!.id,
      motelId: motel.id,
      roomId: roomId.id,
      renterId: renterRow.id,
      rentAmount: "99999999999999",
      electricityUsage: "0",
      electricityCost: "99999999999999",
      waterUsage: "0",
      waterCost: "0",
      totalAmount: "99999999999999",
      paymentStatus: "paid",
    },
    {
      billingPeriodId: period!.id,
      motelId: motel.id,
      roomId: room2.id,
      renterId: renterRow2.id,
      rentAmount: "99999999999999",
      electricityUsage: "0",
      electricityCost: "99999999999999",
      waterUsage: "0",
      waterCost: "0",
      totalAmount: "99999999999999",
      paymentStatus: "unpaid",
    },
  ]);
  await db.update(motelTable).set({ electricityPrice: "9999" }).where(eq(motelTable.id, motel.id));
  await save(owner.cookie, motel.id, complete("99999999999999", "0"));
  const data = (await (await report(owner.cookie, motel.id)).json()) as {
    electricity: unknown;
    water: unknown;
    totals: unknown;
  };
  expect(data.electricity).toEqual({
    billed: "199999999999998",
    collected: "99999999999999",
    cost: "99999999999999",
    billedDifference: "99999999999999",
    collectedDifference: "0",
  });
  expect(data.water).toEqual({
    billed: "0",
    collected: "0",
    cost: "0",
    billedDifference: "0",
    collectedDifference: "0",
  });
  expect(data.totals).toEqual({
    billed: "199999999999998",
    collected: "99999999999999",
    outstanding: "99999999999999",
    billedLessUtilityCosts: "99999999999999",
    collectedLessUtilityCosts: "0",
  });
});

test("database enforces month year cost and notes constraints", async () => {
  const owner = await manager("cost-constraints@example.com");
  const motel = await createMotel(owner.id);
  const invalid = [
    { motelId: motel.id, month: 13, year: 2026 },
    { motelId: motel.id, month: 10, year: 10000 },
    { motelId: motel.id, month: 10, year: 2026, electricityAmount: "-1" },
    { motelId: motel.id, month: 10, year: 2026, waterNotes: "x".repeat(2001) },
  ];
  for (const row of invalid) {
    let rejected = false;
    try {
      await db
        .insert(monthlyUtilityCosts)
        .values(row as never)
        .returning();
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  }
  await db
    .insert(monthlyUtilityCosts)
    .values({ motelId: motel.id, month: 10, year: 2026 })
    .returning();
  let duplicateRejected = false;
  try {
    await db
      .insert(monthlyUtilityCosts)
      .values({ motelId: motel.id, month: 10, year: 2026 })
      .returning();
  } catch {
    duplicateRejected = true;
  }
  expect(duplicateRejected).toBe(true);
});
