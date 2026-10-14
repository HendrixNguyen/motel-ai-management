import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { billingPeriods, meterReadings } from "@/modules/billing/billing.schema";

setDefaultTimeout(20_000);
beforeEach(resetDb);

async function login(email: string): Promise<string> {
  await registerManager({ email, password: "aaaaaaaaaa", name: email });
  const response = await app.handle(new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "aaaaaaaaaa" }),
  }));
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie") ?? "";
}

test("creates period and seeds electric/water readings for every room", async () => {
  const cookie = await login("period@example.com");
  const manager = await db.query.managers.findFirst();
  const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "Motel", electricityPrice: "2000", waterPrice: "15000" }).returning();
  await db.insert(rooms).values([{ motelId: motel!.id, name: "P.102" }, { motelId: motel!.id, name: "P.101" }]);
  const response = await app.handle(new Request(`http://localhost/api/manager/motels/${motel!.id}/billing/periods`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ month: 10, year: 2026 }) }));
  expect(response.status).toBe(201);
  const body = await response.json() as { status: string; electricityPrice: string; waterPrice: string; rooms: Array<{ name: string; readings: Array<{ type: string; previousReading: string; currentReading: string | null }> }> };
  expect(body.status).toBe("draft");
  expect((body as { electricityPrice: string }).electricityPrice).toBe("2000");
  expect((body as { waterPrice: string }).waterPrice).toBe("15000");
  expect(body.rooms.map((room) => room.name)).toEqual(["P.101", "P.102"]);
  expect(body.rooms.every((room) => room.readings.length === 2 && room.readings.every((reading) => reading.previousReading === "0.00" && reading.currentReading === null))).toBe(true);
});

test("seeds next period baselines from latest prior electric and water readings", async () => {
  const cookie = await login("baseline-period@example.com");
  const manager = await db.query.managers.findFirst();
  const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "Motel", electricityPrice: "2000", waterPrice: "15000" }).returning();
  const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "P.101" }).returning();
  const [prior] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 9, year: 2026 }).returning();
  await db.insert(meterReadings).values([{ billingPeriodId: prior!.id, roomId: room!.id, type: "electric", previousReading: "100", currentReading: "125.5" }, { billingPeriodId: prior!.id, roomId: room!.id, type: "water", previousReading: "20", currentReading: "24.25" }]);
  const response = await app.handle(new Request(`http://localhost/api/manager/motels/${motel!.id}/billing/periods`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ month: 10, year: 2026 }) }));
  expect(response.status).toBe(201);
  const body = await response.json() as { rooms: Array<{ readings: Array<{ type: string; previousReading: string }> }> };
  expect(body.rooms[0]!.readings).toEqual(expect.arrayContaining([{ type: "electric", previousReading: "125.50" }, { type: "water", previousReading: "24.25" }]));
});

test("unknown period returns 404", async () => {
  const cookie = await login("missing-period@example.com");
  const manager = await db.query.managers.findFirst();
  const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "Motel", electricityPrice: "2000", waterPrice: "15000" }).returning();
  const response = await app.handle(new Request(`http://localhost/api/manager/motels/${motel!.id}/billing/periods/00000000-0000-0000-0000-000000000000`, { headers: { Cookie: cookie } }));
  expect(response.status).toBe(404);
});

test("rejects duplicate period for same motel", async () => {
  const cookie = await login("duplicate@example.com");
  const manager = await db.query.managers.findFirst();
  const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "Motel", electricityPrice: "2000", waterPrice: "15000" }).returning();
  const request = () => app.handle(new Request(`http://localhost/api/manager/motels/${motel!.id}/billing/periods`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ month: 10, year: 2026 }) }));
  expect((await request()).status).toBe(201);
  const duplicate = await request();
  expect(duplicate.status).toBe(409);
});
