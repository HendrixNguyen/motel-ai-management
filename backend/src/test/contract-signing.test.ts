import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { contracts } from "@/modules/contract/contract.schema";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { managers } from "@/modules/auth/auth.schema";
import { requestContractOtp, setRenterOtpSender, verifyContractOtp } from "@/modules/contract/contract.service";

setDefaultTimeout(20_000);
beforeEach(async () => {
  setRenterOtpSender(async () => true);
  await resetDb();
});

async function contractFixture() {
  const [manager] = await db.insert(managers).values({ email: "fixture@example.com", passwordHash: "x", name: "Fixture" }).returning();
  const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "Motel", electricityPrice: "1", waterPrice: "1" }).returning();
  const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101", basePrice: "1" }).returning();
  const [renter] = await db.insert(renters).values({ motelId: motel!.id, name: "Renter", phone: "84123456789" }).returning();
  const [contract] = await db.insert(contracts).values({ motelId: motel!.id, renterId: renter!.id, roomId: room!.id, startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: "1", deposit: "0" }).returning();
  return contract!;
}

describe("renter contract signing", () => {
  test("hashes OTP, verifies once, and activates atomically", async () => {
    const row = await contractFixture();
    const result = await requestContractOtp(row!.id, row!.renterId, row!.motelId, async () => "123456");
    expect(result).toEqual({ sentAt: result.sentAt });
    const stored = await db.query.contracts.findFirst({ where: (c, { eq }) => eq(c.id, row!.id) });
    expect(stored!.otpHash).not.toBe("123456");
    await verifyContractOtp(row!.id, row!.renterId, row!.motelId, "123456");
    const active = await db.query.contracts.findFirst({ where: (c, { eq }) => eq(c.id, row!.id) });
    expect(active!.status).toBe("active");
    expect(active!.otpSignedAt).not.toBeNull();
  });

  test("exhausted verification returns OTP_INVALID", async () => {
    const row = await contractFixture();
    await requestContractOtp(row!.id, row!.renterId, row!.motelId, async () => "123456");
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(verifyContractOtp(row!.id, row!.renterId, row!.motelId, "000000")).rejects.toMatchObject({ code: "OTP_INVALID" });
    }
    await expect(verifyContractOtp(row!.id, row!.renterId, row!.motelId, "000000")).rejects.toMatchObject({ code: "OTP_INVALID" });
  });

  test("invalid verification persists attempt count", async () => {
    const row = await contractFixture();
    await requestContractOtp(row!.id, row!.renterId, row!.motelId, async () => "123456");
    await expect(verifyContractOtp(row!.id, row!.renterId, row!.motelId, "000000")).rejects.toMatchObject({ code: "OTP_INVALID" });
    const stored = await db.query.contracts.findFirst({ where: (c, { eq }) => eq(c.id, row!.id) });
    expect(stored!.otpAttempts).toBe("1");
  });
});
