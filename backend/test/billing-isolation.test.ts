import { beforeEach, describe, expect, test } from "bun:test";
import { resetDb } from "@/db/test-db";
import { AppError } from "@/shared/errors";
import { app } from "@/app";
import { db } from "@/db";
import { registerManager } from "@/modules/auth/auth.service";
import { motels } from "@/modules/motel/motel.schema";
import { billingPeriods, invoices, meterReadings } from "@/modules/billing/billing.schema";
import { managers } from "@/modules/auth/auth.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { paymentProofs } from "@/modules/payment/payment.schema";

beforeEach(resetDb);
describe("billing isolation", () => {
  test("cross-tenant period access returns 404 over HTTP", async () => {
    await registerManager({ email: "iso@example.com", password: "aaaaaaaaaa", name: "M" });
    const login = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "iso@example.com", password: "aaaaaaaaaa" }),
      }),
    );
    const cookie = login.headers.get("set-cookie") ?? "";
    const manager = await db.query.managers.findFirst();
    const [otherManager] = await db
      .insert((await import("@/modules/auth/auth.schema")).managers)
      .values({ email: "other@example.com", passwordHash: "x", name: "O" })
      .returning();
    const [owned] = await db
      .insert(motels)
      .values({ managerId: manager!.id, name: "Owned", electricityPrice: "1", waterPrice: "1" })
      .returning();
    const [other] = await db
      .insert(motels)
      .values({
        managerId: otherManager!.id,
        name: "Other",
        electricityPrice: "1",
        waterPrice: "1",
      })
      .returning();
    expect(other).toBeDefined();
    const [period] = await db
      .insert(billingPeriods)
      .values({ motelId: other!.id, month: 1, year: 2026 })
      .returning();
    const response = await app.handle(
      new Request(
        `http://localhost/api/manager/motels/${owned!.id}/billing/periods/${period!.id}`,
        { headers: { Cookie: cookie } },
      ),
    );
    expect(response.status).toBe(404);
    expect(AppError.notFound().status).toBe(404);
  });

  test("superadmin crosses motel ownership but child IDs stay scoped to their parent", async () => {
    const password = "root password 123";
    const [root] = await db
      .insert(managers)
      .values({
        email: "root@example.com",
        passwordHash: await Bun.password.hash(password, { algorithm: "argon2id" }),
        name: "Root",
        role: "superadmin",
      })
      .returning();
    await registerManager({ email: "owner@example.com", password: "aaaaaaaaaa", name: "Owner" });
    const ownerLogin = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "owner@example.com", password: "aaaaaaaaaa" }),
      }),
    );
    const rootLogin = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: root!.email, password }),
      }),
    );
    const ownerCookie = ownerLogin.headers.get("set-cookie") ?? "";
    const rootCookie = rootLogin.headers.get("set-cookie") ?? "";
    const [otherOwner] = await db
      .insert(managers)
      .values({ email: "other@example.com", passwordHash: "x", name: "Other" })
      .returning();
    const [motelA] = await db
      .insert(motels)
      .values({ managerId: root!.id, name: "Root motel", electricityPrice: "1", waterPrice: "1" })
      .returning();
    const [motelB] = await db
      .insert(motels)
      .values({
        managerId: otherOwner!.id,
        name: "Other motel",
        electricityPrice: "1",
        waterPrice: "1",
      })
      .returning();
    const [room] = await db.insert(rooms).values({ motelId: motelB!.id, name: "101" }).returning();
    const [renter] = await db
      .insert(renters)
      .values({ motelId: motelB!.id, roomId: room!.id, name: "Renter", phone: "84912345678" })
      .returning();
    const [periodA] = await db
      .insert(billingPeriods)
      .values({ motelId: motelA!.id, month: 1, year: 2026 })
      .returning();
    const [periodB] = await db
      .insert(billingPeriods)
      .values({ motelId: motelB!.id, month: 1, year: 2026 })
      .returning();
    const [readingB] = await db
      .insert(meterReadings)
      .values({
        billingPeriodId: periodB!.id,
        roomId: room!.id,
        type: "electric",
        previousReading: "0",
      })
      .returning();
    const [invoiceB] = await db
      .insert(invoices)
      .values({
        motelId: motelB!.id,
        billingPeriodId: periodB!.id,
        roomId: room!.id,
        renterId: renter!.id,
        rentAmount: "1",
        electricityUsage: "0",
        electricityCost: "0",
        waterUsage: "0",
        waterCost: "0",
        totalAmount: "1",
      })
      .returning();
    await db.insert(paymentProofs).values({
      invoiceId: invoiceB!.id,
      motelId: motelB!.id,
      renterId: renter!.id,
      objectKey: `motels/${motelB!.id}/renters/${renter!.id}/payment-proofs/test`,
      contentType: "image/jpeg",
      size: 4,
      checksum: "test-checksum",
    });

    const request = (path: string, cookie: string) =>
      app.handle(new Request(`http://localhost/api${path}`, { headers: { Cookie: cookie } }));
    expect(
      (await request(`/manager/motels/${motelB!.id}/billing/periods`, rootCookie)).status,
    ).toBe(200);
    expect(
      (await request(`/manager/motels/${motelB!.id}/billing/periods`, ownerCookie)).status,
    ).toBe(404);
    expect(
      (await request(`/manager/motels/${motelA!.id}/billing/periods/${periodB!.id}`, rootCookie))
        .status,
    ).toBe(404);
    expect(
      (
        await request(
          `/manager/motels/${motelA!.id}/billing/periods/${periodA!.id}/readings/${readingB!.id}/photo`,
          rootCookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          `/manager/motels/${motelA!.id}/billing/periods/${periodB!.id}/invoices`,
          rootCookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          `/manager/motels/${motelA!.id}/billing/invoices/${invoiceB!.id}/payment-proof`,
          rootCookie,
        )
      ).status,
    ).toBe(404);
    const approval = await app.handle(
      new Request(
        `http://localhost/api/manager/motels/${motelB!.id}/billing/invoices/${invoiceB!.id}/payment-proof/approve`,
        { method: "POST", headers: { Cookie: rootCookie } },
      ),
    );
    expect(approval.status).toBe(200);
    const reviewedProof = await db.query.paymentProofs.findFirst();
    expect(reviewedProof?.reviewedByManagerId).toBe(root!.id);
  });
});
