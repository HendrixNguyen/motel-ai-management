import { beforeEach, describe, expect, test } from "bun:test";
import { resetDb } from "@/db/test-db";
import { db } from "@/db";
import { managers } from "@/modules/auth/auth.schema";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { billingPeriods, invoices } from "@/modules/billing/billing.schema";
import { markInvoicePaid, markInvoiceOverdue } from "@/modules/billing/billing.service";
import { AppError } from "@/shared/errors";

beforeEach(resetDb);
describe("billing payments", () => {
  test("payment transitions are idempotent and block overdue after paid", async () => {
    const [manager] = await db.insert(managers).values({ email: "pay@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "1", waterPrice: "1" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [renter] = await db.insert(renters).values({ motelId: motel!.id, name: "R", phone: "84123456787", roomId: room!.id }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const [invoice] = await db.insert(invoices).values({ billingPeriodId: period!.id, roomId: room!.id, renterId: renter!.id, motelId: motel!.id, rentAmount: "1", electricityUsage: "0", electricityCost: "0", waterUsage: "0", waterCost: "0", totalAmount: "1" }).returning();
    const paid = await markInvoicePaid(invoice!.id, motel!.id, manager!.id);
    const repeated = await markInvoicePaid(invoice!.id, motel!.id, manager!.id);
    expect(paid.paymentStatus).toBe("paid");
    expect(repeated.id).toBe(paid.id);
    expect(repeated.paidAt).toBe(paid.paidAt);
    await expect(markInvoiceOverdue(invoice!.id, motel!.id, manager!.id)).rejects.toMatchObject({ status: 409 });
  });

  test("supports unpaid to overdue success path", async () => {
    const [manager] = await db.insert(managers).values({ email: "overdue@example.com", passwordHash: "x", name: "M" }).returning();
    const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "M", electricityPrice: "1", waterPrice: "1" }).returning();
    const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
    const [renter] = await db.insert(renters).values({ motelId: motel!.id, name: "R", phone: "84123456786", roomId: room!.id }).returning();
    const [period] = await db.insert(billingPeriods).values({ motelId: motel!.id, month: 1, year: 2026 }).returning();
    const [invoice] = await db.insert(invoices).values({ billingPeriodId: period!.id, roomId: room!.id, renterId: renter!.id, motelId: motel!.id, rentAmount: "1", electricityUsage: "0", electricityCost: "0", waterUsage: "0", waterCost: "0", totalAmount: "1" }).returning();
    const overdue = await markInvoiceOverdue(invoice!.id, motel!.id, manager!.id);
    expect(overdue.paymentStatus).toBe("overdue");
    expect(overdue.paidAt).toBeNull();
    expect((await markInvoiceOverdue(invoice!.id, motel!.id, manager!.id)).paymentStatus).toBe("overdue");
  });

  test("payment state conflicts are represented", () => {
    expect(AppError.conflict("x").status).toBe(409);
  });
});
