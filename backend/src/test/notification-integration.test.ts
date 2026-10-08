import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { billingPeriods, invoices } from "@/modules/billing/billing.schema";
import { contracts } from "@/modules/contract/contract.schema";
import { notificationEvents } from "@/modules/notification/notification.schema";
import { createRenterForMotel } from "@/modules/renter/renter.service";
import { markInvoicePaid } from "@/modules/billing/billing.service";
import { requestContractOtp, setRenterOtpSender } from "@/modules/contract/contract.service";
import { eq } from "drizzle-orm";

setDefaultTimeout(120_000);
beforeEach(async () => { await resetDb(); setRenterOtpSender(null); });

async function fixture() {
  const [manager] = await db.insert(managers).values({ email: `${crypto.randomUUID()}@example.com`, passwordHash: "hash", name: "M" }).returning();
  const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "1", waterPrice: "1" }).returning();
  const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
  const [renter] = await db.insert(renters).values({ motelId: motel!.id, roomId: room!.id, name: "R", phone: "84123456787" }).returning();
  return { manager: manager!, motel: motel!, room: room!, renter: renter! };
}

async function keys() {
  return (await db.select({ key: notificationEvents.eventKey }).from(notificationEvents)).map((row) => row.key);
}

describe("domain notification integration", () => {
  test("creates welcome event without exposing a provider route", async () => {
    const { manager, motel, room } = await fixture();
    const renter = await createRenterForMotel(motel.id, manager.id, { name: "New", phone: "84123456786", roomId: room.id });
    expect(await keys()).toContain(`renter:${renter.id}:welcome`);
  });

  test("creates payment event after invoice payment", async () => {
    const { manager, motel, room, renter } = await fixture();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel.id, month: 1, year: 2026 }).returning();
    const [invoice] = await db.insert(invoices).values({ billingPeriodId: period!.id, roomId: room.id, renterId: renter.id, motelId: motel.id, rentAmount: "1", electricityUsage: "0", electricityCost: "0", waterUsage: "0", waterCost: "0", totalAmount: "1" }).returning();
    await markInvoicePaid(invoice!.id, motel.id, manager.id);
    expect(await keys()).toContain(`invoice:${invoice!.id}:paid`);
  });

  test("creates OTP event and keeps contract state safe when notification fails", async () => {
    const { motel, room, renter } = await fixture();
    const [contract] = await db.insert(contracts).values({ motelId: motel.id, renterId: renter.id, roomId: room.id, startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: "1", deposit: "0" }).returning();
    setRenterOtpSender(async () => false);
    await expect(requestContractOtp(contract!.id, renter.id, motel.id, async () => "123456")).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
    const stored = await db.query.contracts.findFirst({ where: eq(contracts.id, contract!.id) });
    expect(stored?.otpSentAt).toBeNull();
    expect(await keys()).toHaveLength(0);
  });
});
