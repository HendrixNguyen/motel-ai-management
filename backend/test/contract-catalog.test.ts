import { describe, expect, it, beforeEach, setDefaultTimeout } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { motels } from "@/modules/motel/motel.schema";
import { contractTemplates, contractTemplateCatalog } from "@/modules/contract/contract.schema";
import { copyContractTemplateCatalogToMotel, getActiveContractTemplateCatalog, listActiveContractTemplateCatalog } from "@/modules/contract/contract-catalog.service";

setDefaultTimeout(120_000);
const passwordHash = await Bun.password.hash("manager password 123", { algorithm: "argon2id" });
beforeEach(async () => resetDb());

async function manager(email: string) {
  const [row] = await db.insert(managers).values({ email, name: email, passwordHash }).returning();
  return row!;
}

async function motel(managerId: string, name: string) {
  const [row] = await db.insert(motels).values({ managerId, name, address: "Address", electricityPrice: "100", waterPrice: "100" }).returning();
  return row!;
}

describe("system contract template catalog", () => {
  it("returns active catalog entries only", async () => {
    await db.insert(contractTemplateCatalog).values([
      { key: "vn-residential-standard", version: 1, name: "Standard", description: "Default rental", clauses: [{ title: "Term", content: "The renter pays monthly." }] },
      { key: "vn-disabled", version: 1, name: "Disabled", description: "Inactive", clauses: [], active: false },
    ]);
    const result = await listActiveContractTemplateCatalog();
    expect(result.map((row) => row.key)).toEqual(["vn-residential-standard"]);
  });

  it("rejects malformed persisted clauses with a controlled error", async () => {
    await db.execute(sql`ALTER TABLE contract_template_catalog DROP CONSTRAINT IF EXISTS contract_template_catalog_clauses_array`);
    await db.insert(contractTemplateCatalog).values({ key: "vn-malformed", version: 1, name: "Malformed", description: "Malformed", clauses: [{ title: "Invalid", content: "valid" }] });
    await db.execute(sql`UPDATE contract_template_catalog SET clauses = '[{"title": 7, "content": false}]'::jsonb WHERE key = 'vn-malformed'`);
    await expect(getActiveContractTemplateCatalog("vn-malformed", 1)).rejects.toThrow("không hợp lệ");
  });

  it("returns 404 for inactive or unknown template versions", async () => {
    await db.insert(contractTemplateCatalog).values({ key: "vn-disabled", version: 1, name: "Inactive", description: "Hidden", clauses: [], active: false });
    await expect(getActiveContractTemplateCatalog("vn-disabled", 1)).rejects.toMatchObject({ status: 404 });
    await expect(getActiveContractTemplateCatalog("vn-missing", 1)).rejects.toMatchObject({ status: 404 });
  });

  it("copies catalog clauses into a distinct motel-owned template", async () => {
    const owner = await manager("owner@example.test");
    const home = await motel(owner.id, "Owner motel");
    const catalog = [{ title: "Term", content: "The renter pays monthly." }];
    await db.insert(contractTemplateCatalog).values({ key: "vn-standard", version: 1, name: "Standard", description: "Default", clauses: catalog });
    const copy = await copyContractTemplateCatalogToMotel(home.id, owner.id, { catalogKey: "vn-standard", catalogVersion: 1 });
    expect(copy).toMatchObject({ motelId: home.id, name: "Standard", isDefault: false, clauses: catalog });
    expect(copy.id).not.toBeUndefined();
    const stored = await db.select().from(contractTemplates);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.motelId).toBe(home.id);
  });

  it("copies catalog clauses and sets the motel-scoped default only when requested", async () => {
    const owner = await manager("defaults@example.test");
    const home = await motel(owner.id, "Defaults motel");
    const clauses = [{ title: "Payment", content: "Pay monthly." }];
    await db.insert(contractTemplateCatalog).values({ key: "vn-standard-default", version: 1, name: "Standard", description: "Default", clauses });
    const copy = await copyContractTemplateCatalogToMotel(home.id, owner.id, { catalogKey: "vn-standard-default", catalogVersion: 1, isDefault: true });
    expect(copy.isDefault).toBe(true);
    const [stored] = await db.select().from(contractTemplates).where(eq(contractTemplates.id, copy.id));
    expect(stored!.clauses).toEqual(clauses);
  });

  it("returns 404 when copying into another manager's motel", async () => {
    const owner = await manager("owner@example.test");
    const intruder = await manager("intruder@example.test");
    const home = await motel(owner.id, "Owner motel");
    await db.insert(contractTemplateCatalog).values({ key: "vn-standard", version: 1, name: "Standard", description: "Default", clauses: [] });
    await expect(copyContractTemplateCatalogToMotel(home.id, intruder.id, { catalogKey: "vn-standard", catalogVersion: 1 })).rejects.toMatchObject({ status: 404 });
    expect(await db.select().from(contractTemplates)).toHaveLength(0);
  });

  it("copies current system template snapshot and does not create contract without manager-owned template", async () => {
    const owner = await manager("owner@example.test");
    const home = await motel(owner.id, "Owner motel");
    const initial = [{ title: "Deposit", content: "Deposit is recorded." }];
    await db.insert(contractTemplateCatalog).values({ key: "vn-standard", version: 1, name: "Standard", description: "Default", clauses: initial });
    const copy = await copyContractTemplateCatalogToMotel(home.id, owner.id, { catalogKey: "vn-standard", catalogVersion: 1 });
    await db.update(contractTemplateCatalog).set({ clauses: [{ title: "Changed", content: "New source text." }] });
    const [stored] = await db.select().from(contractTemplates).where(eq(contractTemplates.id, copy.id));
    expect(stored!.clauses).toEqual(initial);
  });
});
