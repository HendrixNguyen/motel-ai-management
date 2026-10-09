import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { magicLinks, managers } from "@/modules/auth/auth.schema";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import {
  billingPeriods,
  invoices,
  meterReadings,
} from "@/modules/billing/billing.schema";
import { contractTemplates, contracts } from "@/modules/contract/contract.schema";
import { helpTickets } from "@/modules/ticket/ticket.schema";

// `resetDb` drops the schema and re-applies every migration, which takes seconds — past
// Bun's 5 s default, and worse once a long run has churned the system catalogs.
setDefaultTimeout(20_000);

const managerId = "00000000-0000-4000-8000-000000000001";
const motelId = "00000000-0000-4000-8000-000000000002";
const roomId = "00000000-0000-4000-8000-000000000003";
const periodId = "00000000-0000-4000-8000-000000000004";

async function seed() {
  await db.insert(managers).values({
    id: managerId,
    email: "a@example.com",
    passwordHash: "x",
    name: "A",
  });
  await db.insert(motels).values({
    id: motelId,
    managerId,
    name: "M",
    electricityPrice: "3500",
    waterPrice: "25000",
  });
  await db.insert(rooms).values({ id: roomId, motelId, name: "P.101" });
  await db.insert(billingPeriods).values({ id: periodId, motelId, month: 10, year: 2026 });
}

/** A renter in `roomId`, for the constraints that hang off a renter. */
async function seedRenter() {
  await seed();
  const rows = await db
    .insert(renters)
    .values({ motelId, name: "R", phone: "84901234567", roomId })
    .returning();
  return { renterId: rows[0]!.id };
}

beforeEach(resetDb);

describe("schema constraints", () => {
  test("room names are unique within a motel", async () => {
    await seed();
    await db.insert(rooms).values({ motelId, name: "P.102" });
    await expect(
      db.insert(rooms).values({ motelId, name: "P.102" }).execute(),
    ).rejects.toThrow();
  });

  test("a billing period is unique per motel, month, year", async () => {
    await seed();
    await expect(
      db.insert(billingPeriods)
        .values({ motelId, month: 10, year: 2026 })
        .execute(),
    ).rejects.toThrow();
  });

  test("a meter cannot read lower than its previous reading", async () => {
    await seed();
    await expect(
      db.insert(meterReadings).values({
        roomId,
        billingPeriodId: periodId,
        type: "electric",
        previousReading: "100",
        currentReading: "99",
      }).execute(),
    ).rejects.toThrow();
  });

  test("a reading may still be null before the manager submits it", async () => {
    await seed();
    const row = await db
      .insert(meterReadings)
      .values({
        roomId,
        billingPeriodId: periodId,
        type: "water",
        previousReading: "0",
        currentReading: null,
      })
      .returning();
    expect(row[0]?.currentReading).toBeNull();
  });

  test("contract OTP attempts stay between zero and three", async () => {
    await seed();
    const renter = await db
      .insert(renters)
      .values({ motelId, name: "R", phone: "84901234567", roomId })
      .returning();
    const values = {
      renterId: renter[0]!.id,
      roomId,
      motelId,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      monthlyRent: "3000000",
      otpAttempts: "3",
    };
    await db.insert(contracts).values(values);
    await expect(db.insert(contracts).values({ ...values, otpAttempts: "4" }).execute())
      .rejects.toThrow();
    await expect(db.insert(contracts).values({ ...values, otpAttempts: "-1" }).execute())
      .rejects.toThrow();
  });

  test("one active contract per room", async () => {
    await seed();
    const renter = await db
      .insert(renters)
      .values({ motelId, name: "R", phone: "84901234567", roomId })
      .returning();
    const values = {
      renterId: renter[0]!.id,
      roomId,
      motelId,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      monthlyRent: "3000000",
      status: "active" as const,
    };
    await db.insert(contracts).values(values);
    await expect(db.insert(contracts).values(values).execute()).rejects.toThrow();
  });

  test("phone is unique per motel, not globally", async () => {
    await seed();
    await db.insert(renters).values({ motelId, name: "R1", phone: "84901234567" });
    const other = await db
      .insert(motels)
      .values({
        managerId,
        name: "M2",
        electricityPrice: "3500",
        waterPrice: "25000",
      })
      .returning();
    const row = await db
      .insert(renters)
      .values({ motelId: other[0]!.id, name: "R2", phone: "84901234567" })
      .returning();
    expect(row).toHaveLength(1);
  });

  test("contract end date must follow start date", async () => {
    await seed();
    await expect(
      db.insert(contracts).values({
        renterId: "00000000-0000-4000-8000-000000000009",
        roomId,
        motelId,
        startDate: "2026-12-31",
        endDate: "2026-01-01",
        monthlyRent: "3000000",
      }).execute(),
    ).rejects.toThrow();
  });

  test("a manager email is stored lowercase, whatever the request sent", async () => {
    await expect(
      db
        .insert(managers)
        .values({ email: "Mixed@Example.COM", passwordHash: "x", name: "B" })
        .execute(),
    ).rejects.toThrow();
    await db.insert(managers).values({ email: "lower@example.com", passwordHash: "x", name: "C" });
  });

  test("a renter phone must already be normalised to 84XXXXXXXXX", async () => {
    await seed();
    await expect(
      db.insert(renters).values({ motelId, name: "R", phone: "0901234567" }).execute(),
    ).rejects.toThrow();
  });

  test("a billing period month is between 1 and 12", async () => {
    await seed();
    await expect(
      db.insert(billingPeriods).values({ motelId, month: 13, year: 2026 }).execute(),
    ).rejects.toThrow();
    await expect(
      db.insert(billingPeriods).values({ motelId, month: 0, year: 2026 }).execute(),
    ).rejects.toThrow();
  });

  test("at most one default contract template per motel", async () => {
    await seed();
    const values = { motelId, name: "Mẫu", clauses: [], isDefault: true };
    await db.insert(contractTemplates).values(values);
    await expect(db.insert(contractTemplates).values({ ...values, name: "Mẫu 2" }).execute())
      .rejects.toThrow();
    // A second, non-default template is fine.
    await db.insert(contractTemplates).values({ ...values, name: "Mẫu 3", isDefault: false });
  });

  test("one invoice per room per billing period", async () => {
    const { renterId } = await seedRenter();
    const values = {
      billingPeriodId: periodId,
      roomId,
      renterId,
      motelId,
      rentAmount: "3000000",
      electricityUsage: "10",
      electricityCost: "35000",
      waterUsage: "1",
      waterCost: "25000",
      totalAmount: "3060000",
    };
    await db.insert(invoices).values(values);
    await expect(db.insert(invoices).values(values).execute()).rejects.toThrow();
  });

  test("one reading per meter per room per billing period", async () => {
    await seed();
    const values = {
      roomId,
      billingPeriodId: periodId,
      type: "electric" as const,
      previousReading: "100",
      currentReading: "150",
    };
    await db.insert(meterReadings).values(values);
    await expect(db.insert(meterReadings).values({ ...values, currentReading: "160" }).execute())
      .rejects.toThrow();
    // The same meter in the same period is one row; water is a different meter.
    await db.insert(meterReadings).values({ ...values, type: "water" });
  });

  test("a help ticket carries at most five photos", async () => {
    const { renterId } = await seedRenter();
    await expect(
      db
        .insert(helpTickets)
        .values({
          renterId,
          roomId,
          motelId,
          category: "facilities",
          description: "Vòi nước rò",
          photoUrls: ["1", "2", "3", "4", "5", "6"],
        })
        .execute(),
    ).rejects.toThrow();
  });

  test("ticket photo motel scope cannot mismatch ticket motel", async () => {
    const { renterId } = await seedRenter();
    const [otherMotel] = await db.insert(motels).values({ managerId, name: "Other", electricityPrice: "1", waterPrice: "2" }).returning();
    const [ticket] = await db.insert(helpTickets).values({ renterId, roomId, motelId, category: "facilities", description: "Mô tả sự cố đủ dài" }).returning();
    await expect(
      db.execute(sql`INSERT INTO ticket_photo_uploads (ticket_id, motel_id, object_key, content_type, size, checksum) VALUES (${ticket!.id}, ${otherMotel!.id}, 'mismatch', 'image/jpeg', 3, 'checksum')`).execute(),
    ).rejects.toThrow();
  });

  test("a magic link token is unique", async () => {
    const { renterId } = await seedRenter();
    const values = { renterId, token: "token-abc", expiresAt: new Date("2026-10-05T00:00:00Z") };
    await db.insert(magicLinks).values(values);
    await expect(db.insert(magicLinks).values(values).execute()).rejects.toThrow();
  });
});
