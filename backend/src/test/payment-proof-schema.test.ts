import { describe, expect, test, beforeEach } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { billingPeriods, invoices } from "@/modules/billing/billing.schema";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { rooms } from "@/modules/room/room.schema";
import { paymentProofs } from "@/modules/payment/payment.schema";

beforeEach(resetDb);

describe("payment proof database constraints", () => {
  async function fixture() {
    const [manager] = await db.insert(managers).values({ email: "proof@example.com", passwordHash: "x", name: "Manager" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "Motel", electricityPrice: "1", waterPrice: "1" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [renter] = await db.insert(renters).values({ motelId: motel!.id, roomId: room!.id, name: "Renter", phone: "84123456789" }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const [invoice] = await db.insert(invoices).values({ billingPeriodId: period!.id, roomId: room!.id, renterId: renter!.id, motelId: motel!.id, rentAmount: "1", electricityUsage: "0", electricityCost: "0", waterUsage: "0", waterCost: "0", totalAmount: "1" }).returning();
    return { motel: motel!, renter: renter!, invoice: invoice! };
  }

  test("allows one current proof but rejects a second non-rejected proof", async () => {
    const { motel, renter, invoice } = await fixture();
    await db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/one", contentType: "image/jpeg", size: 10, checksum: "a", status: "pending" });
    await expect(db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/two", contentType: "image/png", size: 10, checksum: "b", status: "approved" })).rejects.toThrow();
  });

  test("permits rejected history and rejects inconsistent review state", async () => {
    const { motel, renter, invoice } = await fixture();
    const [manager] = await db.query.managers.findMany({ limit: 1 });
    await db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/rejected", contentType: "image/jpeg", size: 10, checksum: "a", status: "rejected", reviewedAt: new Date(), reviewedByManagerId: manager!.id, rejectionReason: "Blurry" });
    await expect(db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/invalid", contentType: "image/jpeg", size: 10, checksum: "b", status: "approved", reviewedAt: null })).rejects.toThrow();
  });

  test("enforces foreign keys and content metadata checks", async () => {
    const { motel, renter, invoice } = await fixture();
    await expect(db.insert(paymentProofs).values({ invoiceId: crypto.randomUUID(), renterId: renter.id, motelId: motel.id, objectKey: "proof/missing", contentType: "image/jpeg", size: 10, checksum: "a", status: "pending" })).rejects.toThrow();
    await expect(db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/bad", contentType: "image/gif", size: 0, checksum: "", status: "pending" })).rejects.toThrow();
  });
});
