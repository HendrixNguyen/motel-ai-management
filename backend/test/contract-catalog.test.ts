import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { motels } from "@/modules/motel/motel.schema";
import { contractTemplateCatalog } from "@/modules/contract/contract-catalog.schema";
import { contractTemplates } from "@/modules/contract/contract.schema";
import { copySetupTemplate, previewOwnedTemplate } from "@/modules/contract/contract.service";
import {
  previewCatalogTemplate,
  computeTemplateFingerprint,
  getActiveContractTemplateCatalog,
  listActiveContractTemplateCatalog,
  copyContractTemplateCatalogToMotel,
} from "@/modules/contract/contract-catalog.service";

setDefaultTimeout(30_000);
beforeEach(resetDb);

const PASSWORD = "aaaaaaaaaa";

async function login(email: string) {
  await registerManager({ email, password: PASSWORD, name: email });
  const res = await app.handle(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    }),
  );
  return res.headers.get("set-cookie") ?? "";
}

async function api(method: string, path: string, cookie?: string, body?: unknown) {
  return app.handle(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

async function createMotel(managerId: string, name = "Motel") {
  const [row] = await db
    .insert(motels)
    .values({ managerId, name, electricityPrice: "1", waterPrice: "2" })
    .returning();
  return row!;
}

describe("contract catalog and template preview/copy", () => {
  test("anonymous request rejected with 401", async () => {
    const listRes = await api("GET", "/manager/contract-template-catalog");
    expect(listRes.status).toBe(401);

    const previewCatalogRes = await api(
      "GET",
      "/manager/contract-template-catalog/vn-residential/1",
    );
    expect(previewCatalogRes.status).toBe(401);

    const previewOwnedRes = await api(
      "GET",
      "/manager/motels/00000000-0000-0000-0000-000000000000/contract-templates/00000000-0000-0000-0000-000000000000/setup-preview",
    );
    expect(previewOwnedRes.status).toBe(401);

    const fromCatalogRes = await api(
      "POST",
      "/manager/motels/00000000-0000-0000-0000-000000000000/contract-templates/from-catalog",
      undefined,
      { catalogKey: "vn-residential", catalogVersion: 1, isDefault: true },
    );
    expect(fromCatalogRes.status).toBe(401);
  });

  test("foreign_template_returns_404: authenticated manager A attempts preview of manager B's motel template", async () => {
    const cookieA = await login("manager_a@example.com");
    const cookieB = await login("manager_b@example.com");

    const meB = await api("GET", "/auth/me", cookieB);
    const managerB = (await meB.json()) as { id: string };
    const motelB = await createMotel(managerB.id, "Motel B");

    const [tplB] = await db
      .insert(contractTemplates)
      .values({
        motelId: motelB.id,
        name: "Mẫu Motel B",
        clauses: [{ title: "Điều 1", content: "Nội dung B" }],
        isDefault: true,
      })
      .returning();

    const previewRes = await api(
      "GET",
      `/manager/motels/${motelB.id}/contract-templates/${tplB!.id}/setup-preview`,
      cookieA,
    );
    expect(previewRes.status).toBe(404);

    const meA = await api("GET", "/auth/me", cookieA);
    const managerA = (await meA.json()) as { id: string };

    await expect(previewOwnedTemplate(managerA.id, motelB.id, tplB!.id)).rejects.toThrow();
  });

  test("catalog list returns newest active version per key; inactive versions excluded", async () => {
    const cookie = await login("manager_catalog@example.com");

    await db.insert(contractTemplateCatalog).values([
      {
        key: "key-1",
        version: 1,
        name: "Key 1 v1",
        description: "Desc 1 v1",
        clauses: [{ title: "T1", content: "C1" }],
        active: true,
      },
      {
        key: "key-1",
        version: 2,
        name: "Key 1 v2",
        description: "Desc 1 v2",
        clauses: [{ title: "T1", content: "C1 v2" }],
        active: true,
      },
      {
        key: "key-1",
        version: 3,
        name: "Key 1 v3",
        description: "Desc 1 v3",
        clauses: [{ title: "T1", content: "C1 v3" }],
        active: false,
      },
      {
        key: "key-2",
        version: 1,
        name: "Key 2 v1",
        description: "Desc 2 v1",
        clauses: [{ title: "T2", content: "C2" }],
        active: false,
      },
      {
        key: "key-3",
        version: 1,
        name: "Key 3 v1",
        description: "Desc 3 v1",
        clauses: [{ title: "T3", content: "C3" }],
        active: true,
      },
    ]);

    const res = await api("GET", "/manager/contract-template-catalog", cookie);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Array<{ key: string; version: number; name: string }>;

    expect(data.length).toBe(2);
    const item1 = data.find((d) => d.key === "key-1");
    expect(item1).toBeDefined();
    expect(item1!.version).toBe(2);
    expect(item1!.name).toBe("Key 1 v2");

    const item3 = data.find((d) => d.key === "key-3");
    expect(item3).toBeDefined();
    expect(item3!.version).toBe(1);

    expect(data.find((d) => d.key === "key-2")).toBeUndefined();
  });

  test("inactive catalog item detail returns 404", async () => {
    const cookie = await login("manager_inactive@example.com");

    await db.insert(contractTemplateCatalog).values([
      {
        key: "inactive-key",
        version: 1,
        name: "Inactive v1",
        description: "Inactive Desc",
        clauses: [{ title: "T", content: "C" }],
        active: false,
      },
    ]);

    const res = await api("GET", "/manager/contract-template-catalog/inactive-key/1", cookie);
    expect(res.status).toBe(404);

    await expect(previewCatalogTemplate("inactive-key", 1)).rejects.toThrow();
  });

  test("active catalog item preview returns normalized fingerprint and selection", async () => {
    const cookie = await login("manager_preview@example.com");

    await db.insert(contractTemplateCatalog).values([
      {
        key: "active-key",
        version: 1,
        name: "Active v1",
        description: "Active Desc",
        clauses: [{ title: "T", content: "C" }],
        active: true,
      },
    ]);

    const res = await api("GET", "/manager/contract-template-catalog/active-key/1", cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      name: string;
      clauses: Array<{ title: string; content: string }>;
      selection: { kind: string; key: string; version: number };
    };
    expect(body.name).toBe("Active v1");
    expect(body.clauses).toEqual([{ title: "T", content: "C" }]);
    expect(body.selection).toEqual({
      kind: "catalog",
      key: "active-key",
      version: 1,
    });
  });

  test("SHA-256 fingerprint: calculated on normalized {name, clauses} (keys sorted, stable json)", () => {
    const fp1 = computeTemplateFingerprint("Mẫu A", [{ title: "A", content: "B" }]);
    const fp2 = computeTemplateFingerprint("Mẫu A", [{ title: "A", content: "B" }]);
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[a-f0-9]{64}$/);

    const fpDifferentName = computeTemplateFingerprint("Mẫu B", [{ title: "A", content: "B" }]);
    expect(fpDifferentName).not.toBe(fp1);

    const fpDifferentClauses = computeTemplateFingerprint("Mẫu A", [{ title: "A", content: "C" }]);
    expect(fpDifferentClauses).not.toBe(fp1);
  });

  test("copySetupTemplate: locks source template and compares fingerprint; rejects with SETUP_SOURCE_CHANGED (409) if changed", async () => {
    const cookie = await login("manager_copy@example.com");
    const me = await api("GET", "/auth/me", cookie);
    const manager = (await me.json()) as { id: string };

    const sourceMotel = await createMotel(manager.id, "Source Motel");
    const targetMotel = await createMotel(manager.id, "Target Motel");

    const [srcTpl] = await db
      .insert(contractTemplates)
      .values({
        motelId: sourceMotel.id,
        name: "Original Template",
        clauses: [{ title: "T1", content: "C1" }],
        isDefault: true,
      })
      .returning();

    const preview = await previewOwnedTemplate(manager.id, sourceMotel.id, srcTpl!.id);
    expect(preview.selection.kind).toBe("motel");
    const originalFp = (preview.selection as { fingerprint: string }).fingerprint;

    await db
      .update(contractTemplates)
      .set({ name: "Mutated Template" })
      .where(eq(contractTemplates.id, srcTpl!.id));

    const beforeCount = await db.$count(contractTemplates);

    await expect(
      db.transaction(async (tx) => {
        return copySetupTemplate(
          tx,
          manager.id,
          targetMotel.id,
          {
            kind: "motel",
            motelId: sourceMotel.id,
            templateId: srcTpl!.id,
            fingerprint: originalFp,
          },
          true,
        );
      }),
    ).rejects.toMatchObject({ code: "SETUP_SOURCE_CHANGED", status: 409 });

    const afterCount = await db.$count(contractTemplates);
    expect(afterCount).toBe(beforeCount);
  });

  test("copying template with isDefault: false does not clear existing default", async () => {
    const cookie = await login("manager_default@example.com");
    const me = await api("GET", "/auth/me", cookie);
    const manager = (await me.json()) as { id: string };

    const sourceMotel = await createMotel(manager.id, "Source");
    const targetMotel = await createMotel(manager.id, "Target");

    const [existingDefault] = await db
      .insert(contractTemplates)
      .values({
        motelId: targetMotel.id,
        name: "Existing Default",
        clauses: [{ title: "T0", content: "C0" }],
        isDefault: true,
      })
      .returning();

    const [srcTpl] = await db
      .insert(contractTemplates)
      .values({
        motelId: sourceMotel.id,
        name: "Source Tpl",
        clauses: [{ title: "T1", content: "C1" }],
        isDefault: false,
      })
      .returning();

    const preview = await previewOwnedTemplate(manager.id, sourceMotel.id, srcTpl!.id);

    const copied = await db.transaction(async (tx) => {
      return copySetupTemplate(tx, manager.id, targetMotel.id, preview.selection, false);
    });

    expect(copied.isDefault).toBe(false);

    const reloadedExistingDefault = await db.query.contractTemplates.findFirst({
      where: (t, { eq }) => eq(t.id, existingDefault!.id),
    });
    expect(reloadedExistingDefault!.isDefault).toBe(true);
  });

  test("POST /api/manager/motels/:motelId/contract-templates/from-catalog accepts {catalogKey, catalogVersion, isDefault}, returns existing ContractTemplateResponse (201)", async () => {
    const cookie = await login("manager_from_catalog@example.com");
    const me = await api("GET", "/auth/me", cookie);
    const manager = (await me.json()) as { id: string };

    const motel = await createMotel(manager.id, "Motel Catalog Import");

    await db.insert(contractTemplateCatalog).values([
      {
        key: "standard-lease",
        version: 1,
        name: "Hợp đồng chuẩn",
        description: "Mẫu hợp đồng chuẩn mẫu",
        clauses: [
          { title: "Điều 1: Giá", content: "Giá cố định" },
          { title: "Điều 2: Đặt cọc", content: "1 tháng" },
        ],
        active: true,
      },
    ]);

    const res = await api(
      "POST",
      `/manager/motels/${motel.id}/contract-templates/from-catalog`,
      cookie,
      {
        catalogKey: "standard-lease",
        catalogVersion: 1,
        isDefault: true,
      },
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      motelId: string;
      name: string;
      clauses: Array<{ title: string; content: string }>;
      isDefault: boolean;
      createdAt: string;
    };

    expect(body.motelId).toBe(motel.id);
    expect(body.name).toBe("Hợp đồng chuẩn");
    expect(body.clauses).toEqual([
      { title: "Điều 1: Giá", content: "Giá cố định" },
      { title: "Điều 2: Đặt cọc", content: "1 tháng" },
    ]);
    expect(body.isDefault).toBe(true);
    expect(typeof body.createdAt).toBe("string");

    const saved = await db.query.contractTemplates.findFirst({
      where: (t, { eq }) => eq(t.id, body.id),
    });
    expect(saved).toBeDefined();
    expect(saved!.isDefault).toBe(true);
  });

  test("rejects malformed persisted clauses with a controlled error", async () => {
    await db.execute(
      sql`ALTER TABLE contract_template_catalog DROP CONSTRAINT IF EXISTS contract_template_catalog_clauses_array`,
    );
    await db.insert(contractTemplateCatalog).values({
      key: "vn-malformed",
      version: 1,
      name: "Malformed",
      description: "Malformed",
      clauses: [{ title: "Invalid", content: "valid" }],
      active: true,
    });
    await db.execute(
      sql`UPDATE contract_template_catalog SET clauses = '[{"title": 7, "content": false}]'::jsonb WHERE key = 'vn-malformed'`,
    );
    await expect(getActiveContractTemplateCatalog("vn-malformed", 1)).rejects.toThrow(
      "không hợp lệ",
    );
  });
});
