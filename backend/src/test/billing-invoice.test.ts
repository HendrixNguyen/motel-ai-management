import { beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { billingPeriods, invoices, meterReadings } from "@/modules/billing/billing.schema";
import { contracts } from "@/modules/contract/contract.schema";
import { motels } from "@/modules/motel/motel.schema";
import { managers } from "@/modules/auth/auth.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { generateInvoices } from "@/modules/billing/billing.service";

beforeEach(resetDb);
describe("billing invoices", () => {
  test("rejects invoice generation without bank configuration", async () => {
    const [manager] = await db.insert(managers).values({ email: "nobank@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101", basePrice: "5000000" }).returning();
    const [renter] = await db.insert(renters).values({ motelId: motel!.id, name: "R", phone: "84123456785", roomId: room!.id }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    await db.insert(meterReadings).values([{ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "0", currentReading: "1" }, { billingPeriodId: period!.id, roomId: room!.id, type: "water", previousReading: "0", currentReading: "1" }]);
    await db.insert(contracts).values({ motelId: motel!.id, roomId: room!.id, renterId: renter!.id, startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: "5000000", status: "active" });
    await expect(generateInvoices(period!.id, motel!.id, manager!.id)).rejects.toMatchObject({ status: 409 });
    expect(await db.select().from(invoices)).toHaveLength(0);
  });

  test("generation skips room without active contract", async () => {
    const [manager] = await db.insert(managers).values({ email: "invoice@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000", bankAccount: { bankCode: "970422", accountNumber: "123456", accountName: "M" } }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    await db.insert(renters).values({ motelId: motel!.id, name: "R", phone: "84123456789", roomId: room!.id });
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const result = await generateInvoices(period!.id, motel!.id, manager!.id);
    expect(result.invoices).toHaveLength(0);
    expect(result.details.skippedRooms).toHaveLength(1);
    expect(result.details.skippedRooms[0]!.name).toBe("101");
  });

  test("generation snapshots amounts and preserves paid invoice on rerun", async () => {
    const [manager] = await db.insert(managers).values({ email: "invoice2@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000", bankAccount: { bankCode: "970422", accountNumber: "123456", accountName: "M" } }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101", basePrice: "5000000" }).returning();
    const [renter] = await db.insert(renters).values({ motelId: motel!.id, name: "R", phone: "84123456788", roomId: room!.id }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const readings = await db.insert(meterReadings).values([{ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "10.00", currentReading: "20.00" }, { billingPeriodId: period!.id, roomId: room!.id, type: "water", previousReading: "5.00", currentReading: "8.00" }]).returning();
    await db.insert(contracts).values({ motelId: motel!.id, roomId: room!.id, renterId: renter!.id, startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: "5000000", status: "active" });
    const first = await generateInvoices(period!.id, motel!.id, manager!.id);
    const invoice = first.invoices[0]!;
    await db.update(invoices).set({ paymentStatus: "paid", paidAt: new Date() }).where(eq(invoices.id, invoice.id));
    const second = await generateInvoices(period!.id, motel!.id, manager!.id);
    expect(second.invoices[0]!.id).toBe(invoice.id);
    expect(second.invoices[0]!.paymentStatus).toBe("paid");
    expect(second.invoices[0]!.electricityUsage).toBe("10");
    expect(second.invoices[0]!.waterUsage).toBe("3");
    expect(second.invoices[0]!.totalAmount).toBe(invoice.totalAmount);
    expect(readings).toHaveLength(2);
  });
});
