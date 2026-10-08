import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { billingPeriods, invoices } from "@/modules/billing/billing.schema";
import { contracts } from "@/modules/contract/contract.schema";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { rooms } from "@/modules/room/room.schema";
import { issueMagicLink } from "@/shared/magic-link";

setDefaultTimeout(20_000);
beforeEach(resetDb);

async function seed() {
  const manager = await registerManager({ email: "portal@example.com", password: "aaaaaaaa", name: "Manager" });
  const [motelA, motelB] = await db.insert(motels).values([
    { managerId: manager.id, name: "Nhà A", electricityPrice: "3500", waterPrice: "25000", bankAccount: { bankCode: "970422", accountNumber: "123456", accountName: "NHA A" } },
    { managerId: manager.id, name: "Nhà B", electricityPrice: "3500", waterPrice: "25000" },
  ]).returning();
  const [roomA, roomB] = await db.insert(rooms).values([
    { motelId: motelA!.id, name: "P.101", floor: 1, basePrice: "5000000" },
    { motelId: motelB!.id, name: "P.202", floor: 2, basePrice: "6000000" },
  ]).returning();
  const [renterA, renterB] = await db.insert(renters).values([
    { motelId: motelA!.id, roomId: roomA!.id, name: "Renter A", phone: "84901234567" },
    { motelId: motelB!.id, roomId: roomB!.id, name: "Renter B", phone: "84901234568" },
  ]).returning();
  const [periodA, periodB] = await db.insert(billingPeriods).values([
    { motelId: motelA!.id, month: 1, year: 2026, status: "sent" },
    { motelId: motelB!.id, month: 1, year: 2026, status: "sent" },
  ]).returning();
  const [contract] = await db.insert(contracts).values({ motelId: motelA!.id, renterId: renterA!.id, roomId: roomA!.id, startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: "5000000", deposit: "5000000", clauses: [{ title: "Điều 1", content: "Nội dung" }], status: "active" }).returning();
  const [invoiceA] = await db.insert(invoices).values({ billingPeriodId: periodA!.id, motelId: motelA!.id, renterId: renterA!.id, roomId: roomA!.id, rentAmount: "5000000", electricityUsage: "10.00", electricityCost: "35000", waterUsage: "4.00", waterCost: "100000", otherFees: [{ name: "Rác", amount: "50000" }], totalAmount: "5185000", qrCodeData: "PAYLOAD" }).returning();
  return { renterA: renterA!, renterB: renterB!, periodA: periodA!, periodB: periodB!, invoiceA: invoiceA!, contract: contract! };
}

async function sessionCookie(renterId: string) {
  const { token } = await issueMagicLink(renterId);
  const response = await app.handle(new Request("http://localhost/api/renter/magic-links/exchange", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }));
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";", 1)[0]!;
}

describe("renter portal reads", () => {
  test("returns own profile with room, motel, and active contract without manager fields", async () => {
    const data = await seed();
    const response = await app.handle(new Request("http://localhost/api/renter/me", { headers: { cookie: await sessionCookie(data.renterA.id) } }));
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body).toMatchObject({ id: data.renterA.id, name: "Renter A", room: { id: data.renterA.roomId, name: "P.101" }, motel: { id: data.renterA.motelId, name: "Nhà A" }, activeContract: { id: data.contract.id, monthlyRent: "5000000" } });
    expect(body).not.toHaveProperty("idNumber");
    expect(body).not.toHaveProperty("motel.managerId");
    expect(body.activeContract).not.toHaveProperty("otpHash");
  });

  test("lists only own motel periods and own invoices", async () => {
    const data = await seed();
    const cookie = await sessionCookie(data.renterA.id);
    const periods = await app.handle(new Request("http://localhost/api/renter/billing/periods", { headers: { cookie } }));
    expect(periods.status).toBe(200);
    expect(await periods.json()).toEqual([expect.objectContaining({ id: data.periodA.id, month: 1, year: 2026 })]);
    const invoicesResponse = await app.handle(new Request(`http://localhost/api/renter/billing/periods/${data.periodA.id}/invoices`, { headers: { cookie } }));
    expect(invoicesResponse.status).toBe(200);
    const body = await invoicesResponse.json() as any;
    expect(body).toEqual([expect.objectContaining({ id: data.invoiceA.id, roomName: "P.101", totalAmount: "5185000", qrCodeData: "PAYLOAD", paymentStatus: "unpaid" })]);
    expect(body[0]).not.toHaveProperty("motelId");
    expect(body[0]).not.toHaveProperty("managerNote");
  });

  test("rejects foreign period IDs and cannot mutate payment state", async () => {
    const data = await seed();
    const cookie = await sessionCookie(data.renterA.id);
    const foreign = await app.handle(new Request(`http://localhost/api/renter/billing/periods/${data.periodB.id}/invoices`, { headers: { cookie } }));
    expect(foreign.status).toBe(404);
    expect(await db.query.invoices.findFirst({ where: eq(invoices.id, data.invoiceA.id) })).toMatchObject({ paymentStatus: "unpaid" });
  });
});
