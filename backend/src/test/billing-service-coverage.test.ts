import { randomInt } from "node:crypto";
import { beforeEach, describe, expect, test } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { contracts } from "@/modules/contract/contract.schema";
import { billingPeriods, meterReadings, invoices } from "@/modules/billing/billing.schema";
import { paymentProofs } from "@/modules/payment/payment.schema";
import { configureUploadStorage, createBillingPeriod, generateInvoices, getRenterInvoiceDetail, hasRenterInvoicePeriod, listBillingPeriodsForRenter, listInvoices, listRenterInvoicesForPeriod, updateMeterReadings } from "@/modules/billing/billing.service";
import { FakeStorageAdapter } from "@/shared/storage";
import { resetRateLimits } from "@/shared/rate-limit";
import { eq } from "drizzle-orm";

let managerId = "", motelId = "", roomId = "", renterId = "", periodId = "";
beforeEach(async () => {
  resetRateLimits(); await resetDb(); configureUploadStorage(new FakeStorageAdapter());
  const [manager] = await db.insert(managers).values({ email: `${crypto.randomUUID()}@test.invalid`, passwordHash: "hash", name: "Manager" }).returning(); managerId = manager!.id;
  const [motel] = await db.insert(motels).values({ managerId, name: "Motel", electricityPrice: "10", waterPrice: "20", bankAccount: { bankCode: "970436", accountNumber: "123456", accountName: "TEST" } }).returning(); motelId = motel!.id;
  const [room] = await db.insert(rooms).values({ motelId, name: "101", floor: 1, basePrice: "100" }).returning(); roomId = room!.id;
  const [renter] = await db.insert(renters).values({ motelId, roomId, name: "A", phone: `84${randomInt(100_000_000, 1_000_000_000)}` }).returning(); renterId = renter!.id;
  await db.insert(contracts).values({ motelId, roomId, renterId, startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: "100", deposit: "0", status: "active" });
  const [period] = await db.insert(billingPeriods).values({ motelId, month: 4, year: 2026 }).returning(); periodId = period!.id;
  await db.insert(meterReadings).values([{ billingPeriodId: periodId, roomId, type: "electric", previousReading: "0.00", currentReading: "10.00" }, { billingPeriodId: periodId, roomId, type: "water", previousReading: "0.00", currentReading: "5.00" }]);
});

describe("billing service branches", () => {
  test("renter period queries deduplicate period rows and allow empty/no-room detail", async () => {
    const generated = await generateInvoices(periodId, motelId, managerId);
    const invoice = generated.invoices[0]!;
    expect(await hasRenterInvoicePeriod(renterId, motelId, periodId)).toBe(true);
    expect(await hasRenterInvoicePeriod("00000000-0000-4000-8000-000000000001", motelId, periodId)).toBe(false);
    const periods = await listBillingPeriodsForRenter(motelId, renterId);
    expect(periods).toHaveLength(1);
    expect(await listBillingPeriodsForRenter(motelId, "00000000-0000-4000-8000-000000000001")).toEqual([]);
    expect(await getRenterInvoiceDetail("00000000-0000-4000-8000-000000000001", motelId, generated.invoices[0]!.id)).toBeNull();
  });

  test("manager query scopes, invoice totals and skipped-room details", async () => {
    const generated = await generateInvoices(periodId, motelId, managerId);
    expect(generated.invoices[0]?.totalAmount).toBe("300");
    const absentOwner = await listInvoices(periodId, motelId, "00000000-0000-4000-8000-000000000001").catch((error: unknown) => error);
    expect(absentOwner).toBeDefined();
    expect(await listInvoices(periodId, motelId, managerId)).toHaveLength(1);
    expect(generated.details.skippedRooms).toEqual([]);
  });

  test("creates periods using previous readings and rejects invalid period/month state", async () => {
    const next = await createBillingPeriod(motelId, managerId, { month: 5, year: 2026 });
    expect(next.rooms[0]?.readings.map((row) => row.previousReading).sort()).toEqual(["10.00", "5.00"]);
    await expect(createBillingPeriod(motelId, managerId, { month: 0, year: 2026 })).rejects.toThrow();
    const sent = await db.update(billingPeriods).set({ status: "sent" }).where(eq(billingPeriods.id, periodId)).returning();
    await expect(createBillingPeriod(motelId, managerId, { month: 6, year: 2026 })).resolves.toBeDefined();
    await expect(updateMeterReadings(periodId, motelId, managerId, { readings: [] })).rejects.toThrow();
    expect(sent[0]?.status).toBe("sent");
  });

  test("detects invalid, decreasing, stale, duplicate and sent meter update cases", async () => {
    const readings = await db.query.meterReadings.findMany({ where: eq(meterReadings.billingPeriodId, periodId) });
    const base = { roomId, type: "electric" as const, currentReading: "11", expectedUpdatedAt: String(Math.floor(readings[0]!.updatedAt.getTime() * 1000000)) };
    await expect(updateMeterReadings(periodId, motelId, managerId, { readings: [] })).rejects.toThrow();
    await expect(updateMeterReadings(periodId, motelId, managerId, { readings: [base, base] })).rejects.toThrow();
    await expect(updateMeterReadings(periodId, motelId, managerId, { readings: [{ ...base, currentReading: "-1" }] })).rejects.toThrow();
    await expect(updateMeterReadings(periodId, motelId, managerId, { readings: [{ ...base, expectedUpdatedAt: "not-a-date" }] })).rejects.toThrow();
    await expect(updateMeterReadings(periodId, "00000000-0000-4000-8000-000000000001", managerId, { readings: [base] })).rejects.toThrow();
    await db.update(billingPeriods).set({ status: "sent" }).where(eq(billingPeriods.id, periodId));
    await expect(updateMeterReadings(periodId, motelId, managerId, { readings: [base] })).rejects.toThrow();
  });
});
