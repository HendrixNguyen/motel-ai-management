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
import { listExpiringContracts } from "@/modules/contract/contract.service";
import { requestContractOtp } from "@/modules/contract/contract.service";
import { resetNotificationRecipientResolver, setNotificationRecipientResolver, enqueueNotification } from "@/modules/notification/notification.service";
import { getRenterNotificationRecipient } from "@/modules/renter/renter.service";
import { createPostgresAdvisoryLeaseDb, runWithAdvisoryLease, type AdvisoryLeaseDb } from "@/modules/notification/scheduler.service";
import postgres from "postgres";
import { eq } from "drizzle-orm";

setDefaultTimeout(120_000);
beforeEach(async () => { resetNotificationRecipientResolver(); await resetDb(); });

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

  test("lists active contracts inclusively and excludes inactive contracts", async () => {
    const { motel, room, renter } = await fixture();
    await db.insert(contracts).values([
      { motelId: motel.id, renterId: renter.id, roomId: room.id, startDate: "2026-01-01", endDate: "2026-01-08", monthlyRent: "1", deposit: "0", status: "active" },
      { motelId: motel.id, renterId: renter.id, roomId: room.id, startDate: "2026-01-01", endDate: "2026-01-09", monthlyRent: "1", deposit: "0", status: "expired" },
    ]);
    const rows = await listExpiringContracts(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-08T23:59:59Z"), 7);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.endDate).toBe("2026-01-08");
  });

  test("rejects recipient resolver from another motel", async () => {
    const first = await fixture();
    const second = await fixture();
    setNotificationRecipientResolver(getRenterNotificationRecipient);
    await expect(enqueueNotification({ eventKey: `cross-motel:${crypto.randomUUID()}`, renterId: second.renter.id, motelId: first.motel.id, templateId: "expiry", payload: {} })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("deduplicates expiry notification event key", async () => {
    const { motel, renter } = await fixture();
    setNotificationRecipientResolver(async () => ({ phone: renter.phone, zaloOaId: null, isOaFollower: false }));
    const input = { eventKey: `contract:${crypto.randomUUID()}:expiry:2026-01-08:7`, renterId: renter.id, motelId: motel.id, templateId: "expiry", payload: { contractId: crypto.randomUUID() } };
    await enqueueNotification(input);
    await enqueueNotification(input);
    expect(await keys()).toHaveLength(1);
  });

  test("serializes two workers through real PostgreSQL advisory lease and recovers", async () => {
    const client = postgres(process.env.TEST_DATABASE_URL!, { max: 2, onnotice: () => {} });
    try {
      const lease = createPostgresAdvisoryLeaseDb(client);
      let runs = 0;
      const task = () => runWithAdvisoryLease(lease, 91, async () => { runs++; await new Promise((resolve) => setTimeout(resolve, 25)); return runs; });
      const results = await Promise.all([task(), task()]);
      expect(results.filter((result) => result.acquired)).toHaveLength(1);
      expect(runs).toBe(1);
      expect((await runWithAdvisoryLease(lease, 91, async () => { runs++; return runs; })).acquired).toBe(true);
    } finally {
      await client.end();
    }
  });

  test("serializes two workers through advisory lease", async () => {
    let held = false;
    const dbLease: AdvisoryLeaseDb = { runWithLease: async (_key, task) => { if (held) return { acquired: false }; held = true; try { return { acquired: true, value: await task() }; } finally { held = false; } } };
    let runs = 0;
    const task = () => runWithAdvisoryLease(dbLease, 99, async () => { runs++; await new Promise((resolve) => setTimeout(resolve, 10)); return runs; });
    const results = await Promise.all([task(), task()]);
    expect(results.filter((result) => result.acquired)).toHaveLength(1);
    expect(runs).toBe(1);
  });

  test("creates OTP event and keeps contract state safe when notification fails", async () => {
    const { motel, room, renter } = await fixture();
    const [contract] = await db.insert(contracts).values({ motelId: motel.id, renterId: renter.id, roomId: room.id, startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: "1", deposit: "0" }).returning();
    await expect(requestContractOtp(contract!.id, renter.id, motel.id, async () => "123456")).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
    const stored = await db.query.contracts.findFirst({ where: eq(contracts.id, contract!.id) });
    expect(stored?.otpSentAt).toBeNull();
    expect(await keys()).toHaveLength(0);
  });
});
