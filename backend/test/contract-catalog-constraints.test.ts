import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { contractTemplateCatalog } from "@/modules/contract/contract-catalog.schema";

setDefaultTimeout(30_000);
beforeEach(resetDb);

describe("Contract template catalog database constraints", () => {
  test("unique key/version rejects duplicate catalog rows", async () => {
    const [first] = await db
      .insert(contractTemplateCatalog)
      .values({
        key: "vn-residential-standard",
        version: 1,
        name: "Standard",
        description: "Sample contract template",
        clauses: [],
      })
      .returning({ id: contractTemplateCatalog.id });
    expect(first?.id).toBeTruthy();
    await expect(
      db
        .insert(contractTemplateCatalog)
        .values({
          key: "vn-residential-standard",
          version: 1,
          name: "Duplicate",
          description: "Duplicate version",
          clauses: [],
        })
        .execute(),
    ).rejects.toThrow();
  });

  test("invalid key, version, name and clauses are rejected by PostgreSQL", async () => {
    const cases = [
      { key: "Invalid Key", version: 1, name: "Name", description: "Description", clauses: [] },
      {
        key: "vn-invalid-version",
        version: 0,
        name: "Name",
        description: "Description",
        clauses: [],
      },
      { key: "vn-empty-name", version: 1, name: " ", description: "Description", clauses: [] },
      {
        key: "vn-invalid-clauses",
        version: 1,
        name: "Name",
        description: "Description",
        clauses: {} as unknown as [],
      },
      {
        key: "vn-invalid-clause-shape",
        version: 1,
        name: "Name",
        description: "Description",
        clauses: [{ title: 1, content: true }] as unknown as [],
      },
    ];
    for (const values of cases)
      await expect(db.insert(contractTemplateCatalog).values(values).execute()).rejects.toThrow();
  });
});
