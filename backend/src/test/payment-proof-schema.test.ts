import { describe, expect, test, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
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
    await expect(db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/two", contentType: "image/png", size: 10, checksum: "b", status: "approved" }).execute()).rejects.toThrow();
  });

  test("permits rejected history and replacement current proof", async () => {
    const { motel, renter, invoice } = await fixture();
    const [manager] = await db.query.managers.findMany({ limit: 1 });
    await db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/rejected", contentType: "image/jpeg", size: 10, checksum: "a", status: "rejected", reviewedAt: new Date(), reviewedByManagerId: manager!.id, rejectionReason: "Blurry" });
    await expect(db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/replacement", contentType: "image/png", size: 10, checksum: "b", status: "pending" }).execute()).resolves.toBeDefined();
  });

  test("requires rejection reason only for rejected proofs", async () => {
    const { motel, renter, invoice } = await fixture();
    const [manager] = await db.query.managers.findMany({ limit: 1 });
    await expect(db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/missing-reason", contentType: "image/jpeg", size: 10, checksum: "a", status: "rejected", reviewedAt: new Date(), reviewedByManagerId: manager!.id }).execute()).rejects.toThrow();
    await expect(db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/approved-reason", contentType: "image/jpeg", size: 10, checksum: "b", status: "approved", reviewedAt: new Date(), reviewedByManagerId: manager!.id, rejectionReason: "wrong" }).execute()).rejects.toThrow();
    await expect(db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/long-reason", contentType: "image/jpeg", size: 10, checksum: "c", status: "rejected", reviewedAt: new Date(), reviewedByManagerId: manager!.id, rejectionReason: "x".repeat(501) }).execute()).rejects.toThrow();
  });

  test("rejects mismatched invoice renter and motel ownership", async () => {
    const { motel, renter, invoice } = await fixture();
    const [otherRenter] = await db.insert(renters).values({ motelId: motel.id, name: "Other", phone: "84123456788" }).returning();
    await expect(db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: otherRenter!.id, motelId: motel.id, objectKey: "proof/mismatch", contentType: "image/jpeg", size: 10, checksum: "a", status: "pending" }).execute()).rejects.toThrow();
    expect(renter.id).not.toBe(otherRenter!.id);
  });

  test("preserves rejected proof history after replacement", async () => {
    const { motel, renter, invoice } = await fixture();
    const [manager] = await db.query.managers.findMany({ limit: 1 });
    const [rejected] = await db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/history", contentType: "image/jpeg", size: 10, checksum: "a", status: "rejected", reviewedAt: new Date(), reviewedByManagerId: manager!.id, rejectionReason: "Blurry" }).returning();
    await db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/current", contentType: "image/png", size: 10, checksum: "b", status: "pending" });
    const history = await db.query.paymentProofs.findMany({ where: (proof, { eq }) => eq(proof.id, rejected!.id) });
    expect(history).toHaveLength(1);
    expect(history[0]!.status).toBe("rejected");
  });

  test("rejects every protected update on reviewed proof rows", async () => {
    const { motel, renter, invoice } = await fixture();
    const [manager] = await db.query.managers.findMany({ limit: 1 });
    const mutations = [
      { name: "status", patch: { status: "pending" as const } },
      { name: "reviewer", patch: { reviewedByManagerId: null } },
      { name: "review timestamp", patch: { reviewedAt: null } },
      { name: "reason", patch: { rejectionReason: "changed" } },
      { name: "ownership", patch: { renterId: crypto.randomUUID() } },
      { name: "submitted timestamp", patch: { submittedAt: new Date(0) } },
    ];
    for (const status of ["approved", "rejected"] as const) {
      const [proof] = await db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: `proof/immutable-${status}`, contentType: "image/jpeg", size: 10, checksum: status, status, reviewedAt: new Date(), reviewedByManagerId: manager!.id, rejectionReason: status === "rejected" ? "Blurry" : null }).returning();
      for (const mutation of mutations) {
        const patch = mutation.name === "reason" && status === "approved" ? { rejectionReason: "changed" } : mutation.patch;
        await expect(db.update(paymentProofs).set(patch).where(eq(paymentProofs.id, proof!.id)).execute(), `${status} ${mutation.name}`).rejects.toThrow();
      }
    }
  });

  test("enforces foreign keys and content metadata checks", async () => {
    const { motel, renter, invoice } = await fixture();
    await expect(db.insert(paymentProofs).values({ invoiceId: crypto.randomUUID(), renterId: renter.id, motelId: motel.id, objectKey: "proof/missing", contentType: "image/jpeg", size: 10, checksum: "a", status: "pending" }).execute()).rejects.toThrow();
    await expect(db.insert(paymentProofs).values({ invoiceId: invoice.id, renterId: renter.id, motelId: motel.id, objectKey: "proof/bad", contentType: "image/gif", size: 0, checksum: "", status: "pending" }).execute()).rejects.toThrow();
  });
});
