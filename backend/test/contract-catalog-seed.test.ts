import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { contractTemplateCatalog } from "@/modules/contract/contract-catalog.schema";
import { seedContractCatalog } from "@/modules/contract/contract-catalog.seed";

setDefaultTimeout(20_000);
beforeEach(resetDb);

describe("contract catalog storage and safe seed", () => {
  test("seed_is_idempotent_and_never_reactivates", async () => {
    await seedContractCatalog();
    await seedContractCatalog();

    const rows = await db.select().from(contractTemplateCatalog);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => !r.active)).toBe(true);
    expect(rows.every((r) => r.version === 1)).toBe(true);

    const keys = rows.map((r) => r.key).sort();
    expect(keys).toEqual(["vn-flexible-term", "vn-residential-standard", "vn-service-fees"]);

    await db
      .update(contractTemplateCatalog)
      .set({ active: true, description: "Custom description" })
      .where(sql`${contractTemplateCatalog.key} = 'vn-residential-standard'`);

    await seedContractCatalog();

    const updatedRows = await db.select().from(contractTemplateCatalog);
    expect(updatedRows).toHaveLength(3);
    const standard = updatedRows.find((r) => r.key === "vn-residential-standard");
    expect(standard?.active).toBe(true);
    expect(standard?.description).toBe("Custom description");
  });

  test("rejects duplicate key and version", async () => {
    await seedContractCatalog();

    expect(
      db
        .insert(contractTemplateCatalog)
        .values({
          key: "vn-residential-standard",
          version: 1,
          name: "Trùng",
          description: "Trùng",
          clauses: [{ title: "Điều 1", content: "Nội dung" }],
          active: false,
        })
        .execute(),
    ).rejects.toThrow();
  });

  test("rejects blank key", async () => {
    expect(
      db
        .insert(contractTemplateCatalog)
        .values({
          key: "   ",
          version: 1,
          name: "Trống",
          description: "Mô tả",
          clauses: [{ title: "Điều 1", content: "Nội dung" }],
          active: false,
        })
        .execute(),
    ).rejects.toThrow();
  });

  test("rejects version 0", async () => {
    expect(
      db
        .insert(contractTemplateCatalog)
        .values({
          key: "vn-new-template",
          version: 0,
          name: "Version 0",
          description: "Mô tả",
          clauses: [{ title: "Điều 1", content: "Nội dung" }],
          active: false,
        })
        .execute(),
    ).rejects.toThrow();
  });

  test("version 2 with same key succeeds", async () => {
    await seedContractCatalog();

    const [v2] = await db
      .insert(contractTemplateCatalog)
      .values({
        key: "vn-residential-standard",
        version: 2,
        name: "Mẫu chuẩn v2",
        description: "Mô tả v2",
        clauses: [{ title: "Điều 1", content: "Nội dung v2" }],
        active: false,
      })
      .returning();

    expect(v2).toBeDefined();
    expect(v2?.version).toBe(2);
    expect(v2?.key).toBe("vn-residential-standard");
  });
});
