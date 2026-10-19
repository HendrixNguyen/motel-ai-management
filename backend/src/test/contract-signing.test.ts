import { randomInt } from "node:crypto";
import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { contracts, contractTemplates } from "@/modules/contract/contract.schema";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { managers } from "@/modules/auth/auth.schema";
import { acceptRenterContractConsent, createContract, deleteContractTemplate, getContract, getRenterContract, listContracts, sendContract, terminateContract, updateContract } from "@/modules/contract/contract.service";
import { setNotificationRecipientResolver } from "@/modules/notification/notification.service";

setDefaultTimeout(20_000);
beforeEach(async () => {
  await resetDb();
  setNotificationRecipientResolver(async () => ({ phone: "84901234567" }));
});

async function contractFixture(includeCccd = true) {
  const [manager] = await db.insert(managers).values({ email: `${crypto.randomUUID()}@example.com`, passwordHash: "x", name: "Fixture" }).returning();
  const [motel] = await db.insert(motels).values({ managerId: manager!.id, name: "Motel", electricityPrice: "1", waterPrice: "1" }).returning();
  const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101", basePrice: "1" }).returning();
  const [renter] = await db.insert(renters).values({ motelId: motel!.id, name: "Renter", phone: `84${randomInt(100_000_000, 1_000_000_000)}`, ...(includeCccd ? { idNumber: "079088012345", idCardFrontObjectKey: `motels/${motel!.id}/cccd/front`, idCardFrontContentType: "image/jpeg", idCardFrontSize: 4, idCardFrontChecksum: "test-front", idCardBackObjectKey: `motels/${motel!.id}/cccd/back`, idCardBackContentType: "image/jpeg", idCardBackSize: 4, idCardBackChecksum: "test-back" } : {}) }).returning();
  const [contract] = await db.insert(contracts).values({ motelId: motel!.id, renterId: renter!.id, roomId: room!.id, startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: "1", deposit: "0" }).returning();
  return { ...contract!, managerId: manager!.id, roomId: room!.id };
}

describe("renter contract signing", () => {
  test("lists, reads and sends only manager-owned draft contracts", async () => {
    const row = await contractFixture();
    const all = await listContracts(row.motelId, row.managerId);
    expect(all.map((contract) => contract.id)).toContain(row.id);
    expect(await listContracts(row.motelId, row.managerId, "draft")).toHaveLength(1);
    const detail = await getContract(row.motelId, row.id, row.managerId);
    expect(detail.id).toBe(row.id);
    const sent = await sendContract(row.motelId, row.id, row.managerId);
    expect(sent.managerSentAt).not.toBeNull();
    const foreignList = await listContracts(row.motelId, "foreign-manager").catch((error: unknown) => error);
    const foreignDetail = await getContract(row.motelId, row.id, "foreign-manager").catch((error: unknown) => error);
    expect(String(foreignList)).toContain("foreign-manager");
    expect(String(foreignDetail)).toContain("foreign-manager");
  });

  test("validates create input and contract lifecycle transitions", async () => {
    const row = await contractFixture();
    await expect(createContract(row.motelId, row.managerId, { renterId: row.renterId, roomId: row.roomId, startDate: "bad", endDate: "2026-01-01" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(terminateContract(row.motelId, row.id, row.managerId)).rejects.toMatchObject({ code: "CONFLICT" });
    const template = await db.insert(contractTemplates).values({ motelId: row.motelId, name: "Unused", clauses: [], isDefault: false }).returning();
    await deleteContractTemplate(row.motelId, template[0]!.id, row.managerId);
    const usedTemplate = await db.insert(contractTemplates).values({ motelId: row.motelId, name: "Used", clauses: [], isDefault: false }).returning();
    await db.update(contracts).set({ templateId: usedTemplate[0]!.id }).where(eq(contracts.id, row.id));
    await expect(deleteContractTemplate(row.motelId, usedTemplate[0]!.id, row.managerId)).rejects.toMatchObject({ code: "CONFLICT" });
    const foreignDelete = await deleteContractTemplate(row.motelId, usedTemplate[0]!.id, "foreign-manager").catch((error: unknown) => error);
    expect(String(foreignDelete)).toContain("foreign-manager");
  });

  test("rejects renter contract reads across tenant IDs", async () => {
    const row = await contractFixture();
    const other = await contractFixture();
    await expect(getRenterContract(row.id, other.renterId, other.motelId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getRenterContract("00000000-0000-4000-8000-000000000000", row.renterId, row.motelId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("records explicit consent and immutable term snapshot once", async () => {
    const row = await contractFixture();
    const before = await getRenterContract(row.id, row.renterId, row.motelId);
    const accepted = await acceptRenterContractConsent(row.id, row.renterId, row.motelId, before.termsVersion);
    expect(accepted.status).toBe("active");
    expect(accepted.otpSignedAt).toBeNull();
    expect(accepted.consentMethod).toBe("session_consent");
    expect(accepted.consentAcceptedAt).not.toBeNull();
    expect(accepted.consentEvidence?.termsVersion).toBe(before.termsVersion);
    const retry = await acceptRenterContractConsent(row.id, row.renterId, row.motelId, before.termsVersion);
    expect(retry.consentAcceptedAt).toBe(accepted.consentAcceptedAt);
  });

  test("rejects renter session from another renter without changing contract state", async () => {
    const row = await contractFixture();
    const other = await contractFixture();
    const terms = await getRenterContract(row.id, row.renterId, row.motelId);
    await expect(acceptRenterContractConsent(row.id, other.renterId, other.motelId, terms.termsVersion)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const stored = await db.query.contracts.findFirst({ where: (c, { eq }) => eq(c.id, row.id) });
    expect(stored?.status).toBe("draft");
    expect(stored?.consentAcceptedAt).toBeNull();
  });

  test("rejects changed terms and records no consent", async () => {
    const row = await contractFixture();
    await expect(acceptRenterContractConsent(row.id, row.renterId, row.motelId, "0".repeat(64))).rejects.toMatchObject({ code: "CONFLICT" });
    const stored = await db.query.contracts.findFirst({ where: (c, { eq }) => eq(c.id, row.id) });
    expect(stored?.status).toBe("draft");
    expect(stored?.consentAcceptedAt).toBeNull();
  });

  test("requires manager-uploaded CCCD before consent signing", async () => {
    const row = await contractFixture(false);
    const terms = await getRenterContract(row.id, row.renterId, row.motelId);
    await expect(acceptRenterContractConsent(row.id, row.renterId, row.motelId, terms.termsVersion)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
