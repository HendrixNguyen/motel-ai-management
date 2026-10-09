import { beforeEach, describe, expect, test } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { billingPeriods, meterReadings } from "@/modules/billing/billing.schema";
import { motels } from "@/modules/motel/motel.schema";
import { managers } from "@/modules/auth/auth.schema";
import { rooms } from "@/modules/room/room.schema";
import { eq, sql } from "drizzle-orm";
import { getBillingPeriod, updateMeterReadings } from "@/modules/billing/billing.service";

beforeEach(resetDb);

describe("billing readings", () => {
  test("batch failure rolls back every earlier row", async () => {
    const [manager] = await db.insert(managers).values({ email: "readings@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const readings = await db.insert(meterReadings).values([{ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "0.00" }, { billingPeriodId: period!.id, roomId: room!.id, type: "water", previousReading: "0.00" }]).returning();
    await expect(updateMeterReadings(period!.id, motel!.id, manager!.id, { readings: [{ roomId: room!.id, type: "electric", currentReading: "10", expectedUpdatedAt: (await db.execute(sql`select floor(extract(epoch from updated_at) * 1000000)::bigint::text as version from meter_readings where id = ${readings[0]!.id}`) as { version: string }[])[0]!.version }, { roomId: "00000000-0000-0000-0000-000000000000", type: "water", currentReading: "10", expectedUpdatedAt: (await db.execute(sql`select floor(extract(epoch from updated_at) * 1000000)::bigint::text as version from meter_readings where id = ${readings[1]!.id}`) as { version: string }[])[0]!.version }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await db.query.meterReadings.findMany({ where: (r, { eq }) => eq(r.billingPeriodId, period!.id) })).every((r) => r.currentReading === null)).toBe(true);
  });

  test("returns an exact microsecond version and rejects a distinct same-millisecond version", async () => {
    const [manager] = await db.insert(managers).values({ email: "precision-reading@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const [reading] = await db.insert(meterReadings).values({ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "0", currentReading: "3" }).returning();
    const getVersion = async () => (await db.execute(sql`select floor(extract(epoch from updated_at) * 1000000)::bigint::text as version from meter_readings where id = ${reading!.id}`) as { version: string }[])[0]!.version;
    const version = await getVersion();
    await db.execute(sql`update meter_readings set updated_at = updated_at + interval '1 microsecond' where id = ${reading!.id}`);
    expect(Math.floor(Number(version) / 1000)).toBe(Math.floor(Number(await getVersion()) / 1000));
    await expect(updateMeterReadings(period!.id, motel!.id, manager!.id, { readings: [{ roomId: room!.id, type: "electric", currentReading: "4", expectedUpdatedAt: version }] })).rejects.toMatchObject({ code: "READING_CONFLICT" });
    expect((await db.query.meterReadings.findFirst({ where: eq(meterReadings.id, reading!.id) }))?.currentReading).toBe("3.00");
  });

  test("stores manager current reading and derives usage from previous reading", async () => {
    const [manager] = await db.insert(managers).values({ email: "current-reading@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const [reading] = await db.insert(meterReadings).values({ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "100.25" }).returning();
    const [updated] = await updateMeterReadings(period!.id, motel!.id, manager!.id, { readings: [{ roomId: room!.id, type: "electric", currentReading: "101.50", expectedUpdatedAt: (await db.execute(sql`select floor(extract(epoch from updated_at) * 1000000)::bigint::text as version from meter_readings where id = ${reading!.id}`) as { version: string }[])[0]!.version }] });
    expect(updated).toMatchObject({ previousReading: "100.25", currentReading: "101.50" });
  });

  test("database constraint rejects lower reading even outside service", async () => {
    const [manager] = await db.insert(managers).values({ email: "constraint-reading@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    await expect(db.execute(sql`insert into meter_readings (room_id, billing_period_id, type, previous_reading, current_reading) values (${room!.id}, ${period!.id}, 'electric', '100', '99')`).execute()).rejects.toThrow();
  });

  test("reports missing row after an earlier valid write even when that row is stale", async () => {
    const [manager] = await db.insert(managers).values({ email: "missing-stale@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const readings = await db.insert(meterReadings).values([{ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "0" }, { billingPeriodId: period!.id, roomId: room!.id, type: "water", previousReading: "0" }]).returning();
    const electric = readings.find((r) => r.type === "electric")!;
    const version = (await db.execute(sql`select floor(extract(epoch from updated_at) * 1000000)::bigint::text as version from meter_readings where id = ${electric.id}`) as { version: string }[])[0]!.version;
    await expect(updateMeterReadings(period!.id, motel!.id, manager!.id, { readings: [{ roomId: room!.id, type: "electric", currentReading: "10", expectedUpdatedAt: version }, { roomId: "00000000-0000-0000-0000-000000000000", type: "water", currentReading: "10", expectedUpdatedAt: "0" }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await db.query.meterReadings.findMany({ where: eq(meterReadings.billingPeriodId, period!.id) })).every((r) => r.currentReading === null)).toBe(true);
    await expect(updateMeterReadings(period!.id, motel!.id, manager!.id, { readings: [{ roomId: room!.id, type: "electric", currentReading: "10", expectedUpdatedAt: "0" }, { roomId: room!.id, type: "water", currentReading: "10", expectedUpdatedAt: "0" }] })).rejects.toMatchObject({ code: "READING_CONFLICT" });
    expect((await db.query.meterReadings.findMany({ where: eq(meterReadings.billingPeriodId, period!.id) })).every((r) => r.currentReading === null)).toBe(true);
  });

  test("rejects current reading below previous reading", async () => {
    const [manager] = await db.insert(managers).values({ email: "lower-reading@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const [reading] = await db.insert(meterReadings).values({ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "100.25" }).returning();
    await expect(updateMeterReadings(period!.id, motel!.id, manager!.id, { readings: [{ roomId: room!.id, type: "electric", currentReading: "100", expectedUpdatedAt: (await db.execute(sql`select floor(extract(epoch from updated_at) * 1000000)::bigint::text as version from meter_readings where id = ${reading!.id}`) as { version: string }[])[0]!.version }] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("accepts baseline zero when no prior reading exists", async () => {
    const [manager] = await db.insert(managers).values({ email: "baseline-reading@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const [reading] = await db.insert(meterReadings).values({ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "0" }).returning();
    await expect(updateMeterReadings(period!.id, motel!.id, manager!.id, { readings: [{ roomId: room!.id, type: "electric", currentReading: "1", expectedUpdatedAt: (await db.execute(sql`select floor(extract(epoch from updated_at) * 1000000)::bigint::text as version from meter_readings where id = ${reading!.id}`) as { version: string }[])[0]!.version }] })).resolves.toHaveLength(1);
  });

  test("rejects concurrent writer with same expected timestamp", async () => {
    const [manager] = await db.insert(managers).values({ email: "concurrent@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const [reading] = await db.insert(meterReadings).values({ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "0" }).returning();
    const expectedUpdatedAt = (await db.execute(sql`select floor(extract(epoch from updated_at) * 1000000)::bigint::text as version from meter_readings where id = ${reading!.id}`) as { version: string }[])[0]!.version;
    await updateMeterReadings(period!.id, motel!.id, manager!.id, { readings: [{ roomId: room!.id, type: "electric", currentReading: "10", expectedUpdatedAt }] });
    await expect(updateMeterReadings(period!.id, motel!.id, manager!.id, { readings: [{ roomId: room!.id, type: "electric", currentReading: "20", expectedUpdatedAt }] })).rejects.toMatchObject({ code: "READING_CONFLICT" });
  });

  test("returns precise versions in period reads", async () => {
    const [manager] = await db.insert(managers).values({ email: "period-version@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "2000", waterPrice: "15000" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const [reading] = await db.insert(meterReadings).values({ billingPeriodId: period!.id, roomId: room!.id, type: "electric", previousReading: "0.00", currentReading: "10" }).returning();
    const expectedVersion = (await db.execute(sql`select floor(extract(epoch from updated_at) * 1000000)::bigint::text as version from meter_readings where id = ${reading!.id}`) as { version: string }[])[0]!.version;
    const detail = await getBillingPeriod(period!.id, motel!.id, manager!.id);
    expect(detail.rooms.flatMap((item) => item.readings).find((item) => item.id === reading!.id)?.updatedAt).toBe(expectedVersion);
  });
});
