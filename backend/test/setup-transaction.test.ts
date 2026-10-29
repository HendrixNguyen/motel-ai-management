import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db, type DbTransaction } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { motels } from "@/modules/motel/motel.schema";
import { createMotelInTransaction, lockMotelSetup } from "@/modules/motel/motel.service";
import { rooms } from "@/modules/room/room.schema";
import { createSetupRooms } from "@/modules/room/room.service";
import { contractTemplates } from "@/modules/contract/contract.schema";
import {
  createContractTemplate,
  createContractTemplateInTransaction,
  updateContractTemplate,
} from "@/modules/contract/contract.service";
import { resolveOwnedMotel } from "@/middleware/tenancy";

setDefaultTimeout(20_000);

beforeEach(async () => {
  await resetDb();
});

const PASSWORD = "aaaaaaaaaa";

async function createManager(email = "manager@example.com") {
  return registerManager({ email, password: PASSWORD, name: "Manager" });
}

describe("setup transaction seams", () => {
  test("rollback_removes_all_setup_rows", async () => {
    const manager = await createManager();

    let thrown = false;
    try {
      await db.transaction(async (tx: DbTransaction) => {
        await lockMotelSetup(tx, manager.id);
        const motel = await createMotelInTransaction(tx, manager.id, {
          name: "Nhà trọ rollback",
          electricityPrice: "3500",
          waterPrice: "20000",
        });

        await createContractTemplateInTransaction(tx, motel.id, manager.id, {
          name: "Mẫu hợp đồng chuẩn",
          clauses: [{ title: "Điều 1", content: "Nội quy" }],
          isDefault: true,
        });

        await createSetupRooms(tx, motel.id, manager.id, [
          { name: "P.101", basePrice: "3000000", floor: 1 },
          { name: "P.102", basePrice: "3200000", floor: 1 },
        ]);

        throw new Error("Force rollback");
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Force rollback") {
        thrown = true;
      } else {
        throw err;
      }
    }

    expect(thrown).toBe(true);

    const motelRows = await db.select().from(motels).where(eq(motels.managerId, manager.id));
    const templateRows = await db.select().from(contractTemplates);
    const roomRows = await db.select().from(rooms);

    expect(motelRows).toHaveLength(0);
    expect(templateRows).toHaveLength(0);
    expect(roomRows).toHaveLength(0);
  });

  test("ownership lookup inside transaction sees motel inserted in same transaction", async () => {
    const manager = await createManager();

    await db.transaction(async (tx: DbTransaction) => {
      const motel = await createMotelInTransaction(tx, manager.id, {
        name: "Nhà trọ trong tx",
        electricityPrice: "3500",
        waterPrice: "20000",
      });

      const found = await resolveOwnedMotel(motel.id, manager.id, tx);
      expect(found.id).toBe(motel.id);
      expect(found.name).toBe("Nhà trọ trong tx");
    });
  });

  test("concurrent default template creates/updates yield exactly one default template", async () => {
    const manager = await createManager();

    const motel = await db.transaction(async (tx: DbTransaction) => {
      return createMotelInTransaction(tx, manager.id, {
        name: "Nhà trọ concurrency",
        electricityPrice: "3500",
        waterPrice: "20000",
      });
    });

    const results = await Promise.all([
      createContractTemplate(motel.id, manager.id, {
        name: "Mẫu 1",
        clauses: [{ title: "T1", content: "C1" }],
        isDefault: true,
      }),
      createContractTemplate(motel.id, manager.id, {
        name: "Mẫu 2",
        clauses: [{ title: "T2", content: "C2" }],
        isDefault: true,
      }),
      createContractTemplate(motel.id, manager.id, {
        name: "Mẫu 3",
        clauses: [{ title: "T3", content: "C3" }],
        isDefault: true,
      }),
    ]);

    expect(results).toHaveLength(3);

    const defaultTemplates = await db
      .select()
      .from(contractTemplates)
      .where(
        and(
          eq(contractTemplates.motelId, motelIdCheck(motel.id)),
          eq(contractTemplates.isDefault, true),
        ),
      );

    expect(defaultTemplates).toHaveLength(1);

    const nonDefault = results.find((r) => r.id !== defaultTemplates[0]!.id)!;
    await Promise.all([
      updateContractTemplate(motel.id, nonDefault.id, manager.id, { isDefault: true }),
      updateContractTemplate(motel.id, defaultTemplates[0]!.id, manager.id, { isDefault: true }),
    ]);

    const finalDefaults = await db
      .select()
      .from(contractTemplates)
      .where(and(eq(contractTemplates.motelId, motel.id), eq(contractTemplates.isDefault, true)));

    expect(finalDefaults).toHaveLength(1);
  });
});

function motelIdCheck(id: string) {
  return id;
}
