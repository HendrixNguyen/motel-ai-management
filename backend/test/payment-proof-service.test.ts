import { beforeEach, describe, expect, test } from "bun:test";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { billingPeriods, invoices } from "@/modules/billing/billing.schema";
import { paymentProofs } from "@/modules/payment/payment.schema";
import {
  approvePaymentProof,
  configurePaymentStorage,
  confirmCashPayment,
  getManagerPaymentProof,
  getRenterPaymentProof,
  rejectPaymentProof,
  submitPaymentProof,
} from "@/modules/payment/payment.service";
import { FakeStorageAdapter } from "@/shared/storage";
import { resetRateLimits } from "@/shared/rate-limit";
import { eq } from "drizzle-orm";
import { setNotificationRecipientResolver } from "@/modules/notification/notification.service";
import type { RenterAuthPayload } from "@/middleware/renter-auth";

let managerId: string;
let motelId: string;
let roomId: string;
let renterId: string;
let invoiceId: string;
let renterSession: RenterAuthPayload;
beforeEach(async () => {
  await resetDb();
  resetRateLimits();
  configurePaymentStorage(new FakeStorageAdapter());
  setNotificationRecipientResolver(async () => ({ phone: "84901234567" }));
  const manager = (
    await db
      .insert(managers)
      .values({
        email: `${crypto.randomUUID()}@test.invalid`,
        passwordHash: "hash",
        name: "Manager",
      })
      .returning()
  )[0]!;
  managerId = manager.id;
  const motel = (
    await db
      .insert(motels)
      .values({ managerId, name: "Motel", electricityPrice: "10", waterPrice: "20" })
      .returning()
  )[0]!;
  motelId = motel.id;
  const room = (
    await db.insert(rooms).values({ motelId, name: "101", floor: 1, basePrice: "100" }).returning()
  )[0]!;
  roomId = room.id;
  const renter = (
    await db
      .insert(renters)
      .values({
        motelId,
        roomId,
        name: "Renter",
        phone: `84${randomInt(100_000_000, 1_000_000_000)}`,
      })
      .returning()
  )[0]!;
  renterId = renter.id;
  const period = (
    await db
      .insert(billingPeriods)
      .values({ motelId, month: 4, year: 2026, status: "sent" })
      .returning()
  )[0]!;
  const invoice = (
    await db
      .insert(invoices)
      .values({
        motelId,
        billingPeriodId: period.id,
        roomId,
        renterId,
        rentAmount: "100",
        electricityUsage: "1",
        electricityCost: "10",
        waterUsage: "1",
        waterCost: "20",
        otherFees: [],
        totalAmount: "130",
        paymentStatus: "unpaid",
      })
      .returning()
  )[0]!;
  invoiceId = invoice.id;
  renterSession = { renterId, motelId } as RenterAuthPayload;
});

describe("payment proof image upload and review lifecycle", () => {
  test("stores maximum-size proof and reads signed URL", async () => {
    const bytes = new Uint8Array(5_000_000);
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    const result = await submitPaymentProof(
      renterSession,
      invoiceId,
      new File([bytes], "proof.jpg", { type: "image/jpeg" }),
    );
    expect(result.status).toBe("pending");
    expect(result.size).toBe(5_000_000);
    const signed = await getRenterPaymentProof(renterSession, invoiceId);
    expect(signed?.signedUrl).toContain("fake");
  });

  test("rejects missing owner, paid/draft invoice, pending and previously approved proof", async () => {
    const validBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([validBytes], "proof.jpg", { type: "image/jpeg" });
    await expect(
      submitPaymentProof(renterSession, crypto.randomUUID(), file),
    ).rejects.toMatchObject({ status: 404 });
    await db.update(invoices).set({ paymentStatus: "paid" }).where(eq(invoices.id, invoiceId));
    await expect(submitPaymentProof(renterSession, invoiceId, file)).rejects.toMatchObject({
      status: 409,
    });
    await db.update(invoices).set({ paymentStatus: "unpaid" }).where(eq(invoices.id, invoiceId));
    const period = await db.query.billingPeriods.findFirst({
      where: eq(billingPeriods.motelId, motelId),
    });
    await db
      .update(billingPeriods)
      .set({ status: "draft" })
      .where(eq(billingPeriods.id, period!.id));
    await expect(submitPaymentProof(renterSession, invoiceId, file)).rejects.toMatchObject({
      status: 409,
    });
    await db
      .update(billingPeriods)
      .set({ status: "sent" })
      .where(eq(billingPeriods.id, period!.id));
    await submitPaymentProof(renterSession, invoiceId, file);
    await expect(submitPaymentProof(renterSession, invoiceId, file)).rejects.toMatchObject({
      status: 409,
    });
    await db
      .update(paymentProofs)
      .set({ status: "approved", reviewedAt: new Date(), reviewedByManagerId: managerId })
      .where(eq(paymentProofs.invoiceId, invoiceId));
    await expect(submitPaymentProof(renterSession, invoiceId, file)).rejects.toMatchObject({
      status: 409,
    });
  });

  test("lists a signed manager proof, rejects blank reasons, then can reject proof", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    await submitPaymentProof(
      renterSession,
      invoiceId,
      new File([bytes], "proof.jpg", { type: "image/jpeg" }),
    );
    const managerProof = await getManagerPaymentProof(managerId, motelId, invoiceId);
    expect(managerProof.signedUrl).toContain("fake");
    await expect(rejectPaymentProof(managerId, motelId, invoiceId, "   ")).rejects.toMatchObject({
      status: 400,
    });
    const rejected = await rejectPaymentProof(managerId, motelId, invoiceId, "Biên lai không rõ");
    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectionReason).toBe("Biên lai không rõ");
  });

  test("approves once, idempotently repeats same method, and confirms cash separately", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    await submitPaymentProof(
      renterSession,
      invoiceId,
      new File([bytes], "proof.jpg", { type: "image/jpeg" }),
    );
    const approved = await approvePaymentProof(managerId, motelId, invoiceId);
    expect(approved.paymentStatus).toBe("paid");
    expect(approved.paymentMethod).toBe("bank_transfer");
    const retry = await approvePaymentProof(managerId, motelId, invoiceId).catch((error) => error);
    expect(retry).toBeInstanceOf(Error);
    const invoice = (
      await db
        .update(invoices)
        .set({ paymentStatus: "unpaid", paymentMethod: null, paymentProofId: null, paidAt: null })
        .where(eq(invoices.id, invoiceId))
        .returning()
    )[0]!;
    const cash = await confirmCashPayment(managerId, motelId, invoice.id);
    expect(cash.paymentMethod).toBe("cash");
    await expect(confirmCashPayment(managerId, motelId, invoice.id)).rejects.toBeInstanceOf(Error);
  });

  test("manager actions reject unknown owner, invalid rejection, and duplicate proof review", async () => {
    await expect(
      getManagerPaymentProof(managerId, motelId, crypto.randomUUID()),
    ).rejects.toMatchObject({ status: 404 });
    await expect(approvePaymentProof(managerId, motelId, invoiceId)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      rejectPaymentProof(managerId, motelId, invoiceId, "No proof"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(confirmCashPayment(managerId, motelId, crypto.randomUUID())).rejects.toMatchObject(
      { status: 404 },
    );
  });

  test("rejects 5,000,001 bytes with validation error before invoice lookup", async () => {
    await expect(
      submitPaymentProof(
        renterSession,
        crypto.randomUUID(),
        new File([new Uint8Array(5_000_001)], "proof.jpg", { type: "image/jpeg" }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", message: "Tệp vượt quá giới hạn 5 MB" });
  });
});
