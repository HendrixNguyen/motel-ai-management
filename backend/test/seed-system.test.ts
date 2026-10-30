import { beforeEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managerAuditEvents, managers } from "@/modules/auth/auth.schema";
import { SUPERADMIN_EMAIL } from "@/modules/auth/superadmin-identity";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { rooms } from "@/modules/room/room.schema";
import { contractTemplateCatalog } from "@/modules/contract/contract.schema";
import { seedSystem } from "@/db/seed-system";

setDefaultTimeout(120_000);

const password = "safe-superadmin-password-2026";
const env = { NODE_ENV: "production", SUPERADMIN_PASSWORD: password };

beforeEach(async () => {
  await resetDb();
});

describe("system seed", () => {
  it("refuses non-deployed mode", async () => {
    await expect(seedSystem({ ...env, NODE_ENV: "test" })).rejects.toThrow("NODE_ENV");
  });

  it("rejects invalid passwords before writes", async () => {
    for (const value of [undefined, "short", "x".repeat(257), "             "]) {
      await expect(seedSystem({ ...env, SUPERADMIN_PASSWORD: value })).rejects.toThrow(
        "SUPERADMIN_PASSWORD",
      );
      expect(await db.select().from(managers)).toHaveLength(0);
      expect(await db.select().from(contractTemplateCatalog)).toHaveLength(0);
    }
  });

  it("creates only canonical Superadmin and catalog; repeat is idempotent", async () => {
    const outputs: string[] = [];
    const first = await seedSystem(env, (message) => outputs.push(message));
    const firstManager = await db.query.managers.findFirst({ where: eq(managers.email, SUPERADMIN_EMAIL) });
    const second = await seedSystem(env, (message) => outputs.push(message));
    const secondManager = await db.query.managers.findFirst({ where: eq(managers.email, SUPERADMIN_EMAIL) });
    expect(first.insertedCatalogKeys).toHaveLength(3);
    expect(second.insertedCatalogKeys).toHaveLength(0);
    expect(secondManager?.passwordHash).toBe(firstManager?.passwordHash);
    expect(firstManager).toMatchObject({ role: "superadmin", disabledAt: null });
    expect(await db.select().from(managers)).toHaveLength(1);
    expect(await db.select().from(managerAuditEvents)).toHaveLength(1);
    expect(await db.select().from(contractTemplateCatalog)).toHaveLength(3);
    expect(await db.select().from(motels)).toHaveLength(0);
    expect(await db.select().from(rooms)).toHaveLength(0);
    expect(await db.select().from(renters)).toHaveLength(0);
    for (const output of outputs) {
      expect(output).not.toContain(password);
      expect(output).not.toContain(firstManager!.passwordHash);
      expect(output).not.toContain(first.superadminId);
    }
    expect(first.superadminId).toBeTruthy();
  });

  it("rejects conflicting identities without catalog writes", async () => {
    await db.insert(managers).values({
      email: SUPERADMIN_EMAIL,
      name: "Manager",
      passwordHash: await Bun.password.hash(password),
      role: "manager",
    });
    await expect(seedSystem(env)).rejects.toThrow("role");
    expect(await db.select().from(contractTemplateCatalog)).toHaveLength(0);
  });

  it("rejects disabled Superadmin and wrong password without writes", async () => {
    const seeded = await seedSystem(env);
    await db.update(managers).set({ disabledAt: new Date() }).where(eq(managers.email, SUPERADMIN_EMAIL));
    await expect(seedSystem(env)).rejects.toThrow("disabled");
    await db.update(managers).set({ disabledAt: null }).where(eq(managers.email, SUPERADMIN_EMAIL));
    const before = await db.query.managers.findFirst({ where: eq(managers.email, SUPERADMIN_EMAIL) });
    await expect(seedSystem({ ...env, SUPERADMIN_PASSWORD: "different-safe-password-2026" })).rejects.toThrow("password");
    const after = await db.query.managers.findFirst({ where: eq(managers.email, SUPERADMIN_EMAIL) });
    expect(after?.passwordHash).toBe(before?.passwordHash);
    expect(seeded.insertedCatalogKeys).toHaveLength(3);
  });

  it("serializes concurrent calls", async () => {
    const results = await Promise.all([seedSystem(env), seedSystem(env)]);
    expect(new Set(results.map((result) => result.superadminId)).size).toBe(1);
    expect(await db.select().from(managers)).toHaveLength(1);
    expect(await db.select().from(contractTemplateCatalog)).toHaveLength(3);
  });
});
