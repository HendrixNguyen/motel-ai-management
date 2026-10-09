import { beforeEach, describe, expect, test } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { billingPeriods, meterReadings } from "@/modules/billing/billing.schema";
import { motels } from "@/modules/motel/motel.schema";
import { managers } from "@/modules/auth/auth.schema";
import { rooms } from "@/modules/room/room.schema";
import { updateMeterReadings } from "@/modules/billing/billing.service";

beforeEach(resetDb);

describe("billing readings", () => {
  test("batch failure rolls back every earlier row", async () => {
    const [manager] = await db.insert(managers).values({ email: "readings@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const readings = await db.insert(meterReadings).values([{ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "0.00" }, { billingPeriodId: period!.id, roomId: room!.id, type: "water", previousReading: "0.00" }]).returning();
    await expect(updateMeterReadings(period!.id, motel!.id, manager!.id, { readings: [{ roomId: room!.id, type: "electric", currentReading: "10", expectedUpdatedAt: readings[0]!.updatedAt.toISOString() }, { roomId: "00000000-0000-0000-0000-000000000000", type: "water", currentReading: "10", expectedUpdatedAt: readings[1]!.updatedAt.toISOString() }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await db.query.meterReadings.findMany({ where: (r, { eq }) => eq(r.billingPeriodId, period!.id) })).every((r) => r.currentReading === null)).toBe(true);
  });

  test("stores manager current reading and derives usage from previous reading", async () => {
    const [manager] = await db.insert(managers).values({ email: "current-reading@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const [reading] = await db.insert(meterReadings).values({ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "100.25" }).returning();
    const [updated] = await updateMeterReadings(period!.id, motel!.id, manager!.id, { readings: [{ roomId: room!.id, type: "electric", currentReading: "101.50", expectedUpdatedAt: reading!.updatedAt.toISOString() }] });
    expect(updated).toMatchObject({ previousReading: "100.25", currentReading: "101.5" });
  });

  test("rejects current reading below previous reading", async () => {
    const [manager] = await db.insert(managers).values({ email: "lower-reading@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const [reading] = await db.insert(meterReadings).values({ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "100.25" }).returning();
    await expect(updateMeterReadings(period!.id, motel!.id, manager!.id, { readings: [{ roomId: room!.id, type: "electric", currentReading: "100", expectedUpdatedAt: reading!.updatedAt.toISOString() }] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("rejects stale reading update even when value matches latest", async () => {
    const [manager] = await db.insert(managers).values({ email: "stale@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const [reading] = await db.insert(meterReadings).values({ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "0.00", currentReading: "10" }).returning();
    await expect(updateMeterReadings(period!.id, motel!.id, manager!.id, { readings: [{ roomId: room!.id, type: "electric", currentReading: "10", expectedUpdatedAt: new Date(reading!.updatedAt.getTime() - 1000).toISOString() }] })).rejects.toMatchObject({ code: "READING_CONFLICT" });
  });
});
