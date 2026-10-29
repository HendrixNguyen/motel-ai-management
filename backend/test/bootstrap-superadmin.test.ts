import { beforeEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { contractTemplateCatalog } from "@/modules/contract/contract.schema";
import { bootstrapSuperadmin, SUPERADMIN_EMAIL } from "@/db/bootstrap-superadmin";

setDefaultTimeout(120_000);

const password = "safe-superadmin-password-2026";
const confirmation = {
  NODE_ENV: "production",
  PRODUCTION_SUPERADMIN_CONFIRM: SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD: password,
};

beforeEach(async () => {
  await resetDb();
});
describe("production Superadmin bootstrap", () => {
  it("refuses non-production mode", async () => {
    await expect(bootstrapSuperadmin({ ...confirmation, NODE_ENV: "test" })).rejects.toThrow(
      "NODE_ENV=production",
    );
  });

  it("requires explicit email confirmation", async () => {
    await expect(
      bootstrapSuperadmin({ ...confirmation, PRODUCTION_SUPERADMIN_CONFIRM: "wrong@example.com" }),
    ).rejects.toThrow("Set explicit production confirmation");
  });

  it("verifies migration ledger and schema without writes", async () => {
    await expect(
      bootstrapSuperadmin({ ...confirmation, SUPERADMIN_PASSWORD: "short" }),
    ).rejects.toThrow("SUPERADMIN_PASSWORD");
    expect(await db.select().from(managers)).toHaveLength(0);
    expect(await db.select().from(contractTemplateCatalog)).toHaveLength(0);
  });

  it("requires protected password with minimum length", async () => {
    await expect(
      bootstrapSuperadmin({ ...confirmation, SUPERADMIN_PASSWORD: "short" }),
    ).rejects.toThrow("SUPERADMIN_PASSWORD");
  });

  it("creates only one Superadmin and three catalog templates; repeat is idempotent", async () => {
    const firstSummary: string[] = [];
    const secondSummary: string[] = [];
    const first = await bootstrapSuperadmin(confirmation, (message) => firstSummary.push(message));
    const second = await bootstrapSuperadmin(confirmation, (message) =>
      secondSummary.push(message),
    );
    expect(first.insertedCatalogKeys).toHaveLength(3);
    expect(second.insertedCatalogKeys).toHaveLength(0);
    expect(firstSummary[0]).not.toContain(first.superadminId);
    expect(secondSummary[0]).not.toContain(second.superadminId);
    expect(firstSummary[0]).not.toContain(password);
    expect(secondSummary[0]).not.toContain(password);
    const root = await db.query.managers.findMany({ where: eq(managers.email, SUPERADMIN_EMAIL) });
    expect(root).toHaveLength(1);
    expect(root[0]).toMatchObject({ role: "superadmin", disabledAt: null });
    expect(root[0]!.passwordHash).not.toBe(password);
    expect(await db.select().from(contractTemplateCatalog)).toHaveLength(3);
  });

  it("refuses an existing non-Superadmin identity without writes", async () => {
    await db.insert(managers).values({
      email: SUPERADMIN_EMAIL,
      name: "Manager",
      passwordHash: await Bun.password.hash(password),
      role: "manager",
    });
    await expect(bootstrapSuperadmin(confirmation)).rejects.toThrow(
      "Superadmin identity conflicts",
    );
    expect(await db.select().from(contractTemplateCatalog)).toHaveLength(0);
  });

  it("refuses password mismatch without rotating Superadmin credentials", async () => {
    await bootstrapSuperadmin(confirmation);
    const before = await db.query.managers.findFirst({
      where: eq(managers.email, SUPERADMIN_EMAIL),
    });
    await expect(
      bootstrapSuperadmin({ ...confirmation, SUPERADMIN_PASSWORD: "another-safe-password-2026" }),
    ).rejects.toThrow("Superadmin identity conflicts");
    const after = await db.query.managers.findFirst({
      where: eq(managers.email, SUPERADMIN_EMAIL),
    });
    expect(after?.passwordHash).toBe(before?.passwordHash);
  });
});
