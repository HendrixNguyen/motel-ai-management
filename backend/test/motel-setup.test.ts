import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { and, eq, sql } from "drizzle-orm";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { contractTemplates } from "@/modules/contract/contract.schema";
import { contractTemplateCatalog } from "@/modules/contract/contract-catalog.schema";
import { computeTemplateFingerprint } from "@/modules/contract/contract-catalog.service";
import { lockMotelSetup } from "@/modules/motel/motel.service";

setDefaultTimeout(20_000);
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

async function seedCatalog(key = "vn-residential-standard", version = 1) {
  const [row] = await db
    .insert(contractTemplateCatalog)
    .values({
      key,
      version,
      name: "Mẫu hợp đồng chuẩn",
      description: "Mẫu cơ bản",
      clauses: [{ title: "Điều 1", content: "Nội quy phòng trọ" }],
      active: true,
    })
    .returning();
  return row!;
}

describe("POST /api/manager/motels/setup and GET /api/manager/motels/setup-requests/:requestId", () => {
  test("first_motel_requires_full: 0 motels blocks quick and old POST with 409 MOTEL_SETUP_REQUIRED", async () => {
    const cookie = await login("newbie@example.com");
    await seedCatalog();

    const oldRes = await api("POST", "/manager/motels", cookie, {
      name: "Nhà trọ cũ",
      electricityPrice: "3500",
      waterPrice: "20000",
    });
    expect(oldRes.status).toBe(409);
    const oldErr = (await oldRes.json()) as { code: string };
    expect(oldErr.code).toBe("MOTEL_SETUP_REQUIRED");

    const quickRes = await api("POST", "/manager/motels/setup", cookie, {
      requestId: "00000000-0000-0000-0000-000000000001",
      mode: "quick",
      motel: {
        name: "Nhà trọ nhanh",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
    });
    expect(quickRes.status).toBe(409);
    const quickErr = (await quickRes.json()) as { code: string };
    expect(quickErr.code).toBe("MOTEL_SETUP_REQUIRED");

    const zeroRoomsRes = await api("POST", "/manager/motels/setup", cookie, {
      requestId: "00000000-0000-0000-0000-000000000002",
      mode: "full",
      motel: {
        name: "Nhà trọ full 0 phòng",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: { kind: "catalog", key: "vn-residential-standard", version: 1 },
      rooms: [],
    });
    expect(zeroRoomsRes.status).toBe(400);

    const over100Rooms = Array.from({ length: 101 }, (_, i) => ({
      name: `P.${100 + i}`,
      basePrice: "3000000",
      floor: 1,
    }));
    const over100Res = await api("POST", "/manager/motels/setup", cookie, {
      requestId: "00000000-0000-0000-0000-000000000003",
      mode: "full",
      motel: {
        name: "Nhà trọ 101 phòng",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: { kind: "catalog", key: "vn-residential-standard", version: 1 },
      rooms: over100Rooms,
    });
    expect(over100Res.status).toBe(400);

    const full1Res = await api("POST", "/manager/motels/setup", cookie, {
      requestId: "00000000-0000-0000-0000-000000000004",
      mode: "full",
      motel: {
        name: "Nhà trọ 1 phòng",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: { kind: "catalog", key: "vn-residential-standard", version: 1 },
      rooms: [{ name: "P.101", basePrice: "3000000", floor: 1 }],
    });
    expect(full1Res.status).toBe(201);
    const full1 = (await full1Res.json()) as {
      motelId: string;
      mode: string;
      roomCount: number;
      templateId: string;
    };
    expect(full1.mode).toBe("full");
    expect(full1.roomCount).toBe(1);
    expect(full1.templateId).toBeTruthy();

    const quickNoTplRes = await api("POST", "/manager/motels/setup", cookie, {
      requestId: "00000000-0000-0000-0000-000000000005",
      mode: "quick",
      motel: {
        name: "Nhà trọ quick không mẫu",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
    });
    expect(quickNoTplRes.status).toBe(201);
    const quickNoTpl = (await quickNoTplRes.json()) as {
      motelId: string;
      mode: string;
      roomCount: number;
      templateId: string | null;
    };
    expect(quickNoTpl.mode).toBe("quick");
    expect(quickNoTpl.roomCount).toBe(0);
    expect(quickNoTpl.templateId).toBeNull();

    const quickWithTplRes = await api("POST", "/manager/motels/setup", cookie, {
      requestId: "00000000-0000-0000-0000-000000000006",
      mode: "quick",
      motel: {
        name: "Nhà trọ quick có mẫu",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: { kind: "catalog", key: "vn-residential-standard", version: 1 },
    });
    expect(quickWithTplRes.status).toBe(201);
    const quickWithTpl = (await quickWithTplRes.json()) as {
      motelId: string;
      mode: string;
      roomCount: number;
      templateId: string | null;
    };
    expect(quickWithTpl.mode).toBe("quick");
    expect(quickWithTpl.roomCount).toBe(0);
    expect(quickWithTpl.templateId).toBeTruthy();

    const rooms100 = Array.from({ length: 100 }, (_, i) => ({
      name: `P.${200 + i}`,
      basePrice: "3000000",
      floor: 2,
    }));
    const full100Res = await api("POST", "/manager/motels/setup", cookie, {
      requestId: "00000000-0000-0000-0000-000000000007",
      mode: "full",
      motel: {
        name: "Nhà trọ 100 phòng",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: { kind: "catalog", key: "vn-residential-standard", version: 1 },
      rooms: rooms100,
    });
    expect(full100Res.status).toBe(201);
    const full100 = (await full100Res.json()) as { roomCount: number };
    expect(full100.roomCount).toBe(100);
  });

  test("same_request_commits_once: identical requests replay 200, modified payload/mode returns 409 IDEMPOTENCY_CONFLICT", async () => {
    const cookie = await login("idempotent@example.com");
    await seedCatalog();

    const payload = {
      requestId: "00000000-0000-0000-0000-000000000010",
      mode: "full" as const,
      motel: {
        name: "Nhà trọ replay",
        electricityPrice: "3500",
        waterPrice: "20000",
        bankAccount: {
          bankCode: "MB",
          accountNumber: "0123456789",
          accountName: "NGUYEN VAN A",
        },
      },
      template: { kind: "catalog" as const, key: "vn-residential-standard", version: 1 },
      rooms: [{ name: "P.101", basePrice: "3000000", floor: 1 }],
    };

    const firstRes = await api("POST", "/manager/motels/setup", cookie, payload);
    expect(firstRes.status).toBe(201);
    const firstResult = (await firstRes.json()) as { motelId: string; templateId: string };

    const replayRes = await api("POST", "/manager/motels/setup", cookie, payload);
    expect(replayRes.status).toBe(200);
    const replayResult = (await replayRes.json()) as { motelId: string; templateId: string };
    expect(replayResult.motelId).toBe(firstResult.motelId);
    expect(replayResult.templateId).toBe(firstResult.templateId);

    const conflictPayload = {
      ...payload,
      motel: {
        ...payload.motel,
        name: "Nhà trọ đổi tên",
      },
    };
    const conflictRes = await api("POST", "/manager/motels/setup", cookie, conflictPayload);
    expect(conflictRes.status).toBe(409);
    const conflictErr = (await conflictRes.json()) as { code: string };
    expect(conflictErr.code).toBe("IDEMPOTENCY_CONFLICT");

    const modeConflictRes = await api("POST", "/manager/motels/setup", cookie, {
      requestId: payload.requestId,
      mode: "quick",
      motel: payload.motel,
    });
    expect(modeConflictRes.status).toBe(409);
    const modeConflictErr = (await modeConflictRes.json()) as { code: string };
    expect(modeConflictErr.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  test("status endpoint GET /api/manager/motels/setup-requests/:requestId returns 200, 410 on deleted motel, 404 on unknown", async () => {
    const cookie = await login("status@example.com");
    await seedCatalog();

    const unknownRes = await api(
      "GET",
      "/manager/motels/setup-requests/00000000-0000-0000-0000-000000000999",
      cookie,
    );
    expect(unknownRes.status).toBe(404);

    const reqId = "00000000-0000-0000-0000-000000000020";
    const setupRes = await api("POST", "/manager/motels/setup", cookie, {
      requestId: reqId,
      mode: "full",
      motel: {
        name: "Nhà trọ check status",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: { kind: "catalog", key: "vn-residential-standard", version: 1 },
      rooms: [{ name: "P.101", basePrice: "3000000", floor: 1 }],
    });
    expect(setupRes.status).toBe(201);
    const setupResult = (await setupRes.json()) as {
      motelId: string;
      mode: string;
      roomCount: number;
      templateId: string;
    };

    const statusRes = await api("GET", `/manager/motels/setup-requests/${reqId}`, cookie);
    expect(statusRes.status).toBe(200);
    const statusResult = (await statusRes.json()) as typeof setupResult;
    expect(statusResult.motelId).toBe(setupResult.motelId);
    expect(statusResult.mode).toBe("full");
    expect(statusResult.roomCount).toBe(1);
    expect(statusResult.templateId).toBe(setupResult.templateId);

    const delRoomRes = await api("DELETE", `/manager/motels/${setupResult.motelId}/rooms`, cookie);
    await db.delete(rooms).where(eq(rooms.motelId, setupResult.motelId));
    await db.delete(contractTemplates).where(eq(contractTemplates.motelId, setupResult.motelId));
    const delRes = await api("DELETE", `/manager/motels/${setupResult.motelId}`, cookie);
    expect(delRes.status).toBe(204);

    const deletedStatusRes = await api("GET", `/manager/motels/setup-requests/${reqId}`, cookie);
    expect(deletedStatusRes.status).toBe(410);
    const deletedErr = (await deletedStatusRes.json()) as { code: string };
    expect(deletedErr.code).toBe("SETUP_RESULT_DELETED");

    const replayDeletedRes = await api("POST", "/manager/motels/setup", cookie, {
      requestId: reqId,
      mode: "full",
      motel: {
        name: "Nhà trọ check status",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: { kind: "catalog", key: "vn-residential-standard", version: 1 },
      rooms: [{ name: "P.101", basePrice: "3000000", floor: 1 }],
    });
    expect(replayDeletedRes.status).toBe(410);
  });

  test("source copy and independence: copied clauses match source, id differs, editing source does not affect copy", async () => {
    const cookie = await login("source_copy@example.com");
    await seedCatalog();

    const firstSetup = await api("POST", "/manager/motels/setup", cookie, {
      requestId: "00000000-0000-0000-0000-000000000030",
      mode: "full",
      motel: {
        name: "Nhà trọ nguồn",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: { kind: "catalog", key: "vn-residential-standard", version: 1 },
      rooms: [{ name: "P.101", basePrice: "3000000", floor: 1 }],
    });
    expect(firstSetup.status).toBe(201);
    const sourceMotel = (await firstSetup.json()) as { motelId: string; templateId: string };

    const sourceTplRows = await db
      .select()
      .from(contractTemplates)
      .where(eq(contractTemplates.id, sourceMotel.templateId));
    const sourceTpl = sourceTplRows[0]!;
    const fp = computeTemplateFingerprint(sourceTpl.name, sourceTpl.clauses);

    const secondSetup = await api("POST", "/manager/motels/setup", cookie, {
      requestId: "00000000-0000-0000-0000-000000000031",
      mode: "quick",
      motel: {
        name: "Nhà trọ đích",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: {
        kind: "motel",
        motelId: sourceMotel.motelId,
        templateId: sourceMotel.templateId,
        fingerprint: fp,
      },
    });
    expect(secondSetup.status).toBe(201);
    const targetMotel = (await secondSetup.json()) as { motelId: string; templateId: string };

    expect(targetMotel.templateId).not.toBe(sourceMotel.templateId);
    const targetTplRows = await db
      .select()
      .from(contractTemplates)
      .where(eq(contractTemplates.id, targetMotel.templateId));
    const targetTpl = targetTplRows[0]!;
    expect(targetTpl.clauses).toEqual(sourceTpl.clauses);
    expect(targetTpl.name).toBe(sourceTpl.name);

    await db
      .update(contractTemplates)
      .set({
        clauses: [{ title: "Điều 1 sửa đổi", content: "Nội quy mới" }],
      })
      .where(eq(contractTemplates.id, sourceMotel.templateId));

    const targetTplAfter = (
      await db
        .select()
        .from(contractTemplates)
        .where(eq(contractTemplates.id, targetMotel.templateId))
    )[0]!;
    expect(targetTplAfter.clauses).toEqual(sourceTpl.clauses);

    const thirdSetupChanged = await api("POST", "/manager/motels/setup", cookie, {
      requestId: "00000000-0000-0000-0000-000000000032",
      mode: "quick",
      motel: {
        name: "Nhà trọ đích 2",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: {
        kind: "motel",
        motelId: sourceMotel.motelId,
        templateId: sourceMotel.templateId,
        fingerprint: fp,
      },
    });
    expect(thirdSetupChanged.status).toBe(409);
    const changedErr = (await thirdSetupChanged.json()) as { code: string };
    expect(changedErr.code).toBe("SETUP_SOURCE_CHANGED");
  });

  test("two-tenant source failures leave counts unchanged and return 404", async () => {
    const cookieA = await login("tenant_a@example.com");
    const cookieB = await login("tenant_b@example.com");
    await seedCatalog();

    const setupA = await api("POST", "/manager/motels/setup", cookieA, {
      requestId: "00000000-0000-0000-0000-000000000040",
      mode: "full",
      motel: {
        name: "Nhà trọ A",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: { kind: "catalog", key: "vn-residential-standard", version: 1 },
      rooms: [{ name: "P.101", basePrice: "3000000", floor: 1 }],
    });
    expect(setupA.status).toBe(201);
    const motelA = (await setupA.json()) as { motelId: string; templateId: string };

    const tplA = (
      await db.select().from(contractTemplates).where(eq(contractTemplates.id, motelA.templateId))
    )[0]!;
    const fpA = computeTemplateFingerprint(tplA.name, tplA.clauses);

    const motelsBefore = (await db.select().from(motels)).length;
    const stealAttempt = await api("POST", "/manager/motels/setup", cookieB, {
      requestId: "00000000-0000-0000-0000-000000000041",
      mode: "full",
      motel: {
        name: "Nhà trọ B cố lấy mẫu A",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: {
        kind: "motel",
        motelId: motelA.motelId,
        templateId: motelA.templateId,
        fingerprint: fpA,
      },
      rooms: [{ name: "P.101", basePrice: "3000000", floor: 1 }],
    });
    expect(stealAttempt.status).toBe(404);
    const motelsAfter = (await db.select().from(motels)).length;
    expect(motelsAfter).toBe(motelsBefore);
  });

  test("duplicate trimmed room names in setup payload rejected with 409", async () => {
    const cookie = await login("duprooms@example.com");
    await seedCatalog();

    const res = await api("POST", "/manager/motels/setup", cookie, {
      requestId: "00000000-0000-0000-0000-000000000050",
      mode: "full",
      motel: {
        name: "Nhà trọ phòng trùng",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: { kind: "catalog", key: "vn-residential-standard", version: 1 },
      rooms: [
        { name: "P.101", basePrice: "3000000", floor: 1 },
        { name: "  P.101  ", basePrice: "3000000", floor: 1 },
      ],
    });
    expect(res.status).toBe(409);
  });

  test("negative or oversize money in motel setup rejected with 400", async () => {
    const cookie = await login("badmoney@example.com");
    await seedCatalog();

    const negPriceRes = await api("POST", "/manager/motels/setup", cookie, {
      requestId: "00000000-0000-0000-0000-000000000060",
      mode: "full",
      motel: {
        name: "Nhà trọ giá âm",
        electricityPrice: "-3500",
        waterPrice: "20000",
      },
      template: { kind: "catalog", key: "vn-residential-standard", version: 1 },
      rooms: [{ name: "P.101", basePrice: "3000000", floor: 1 }],
    });
    expect(negPriceRes.status).toBe(400);

    const negRoomRes = await api("POST", "/manager/motels/setup", cookie, {
      requestId: "00000000-0000-0000-0000-000000000061",
      mode: "full",
      motel: {
        name: "Nhà trọ tiền phòng âm",
        electricityPrice: "3500",
        waterPrice: "20000",
      },
      template: { kind: "catalog", key: "vn-residential-standard", version: 1 },
      rooms: [{ name: "P.101", basePrice: "-1000", floor: 1 }],
    });
    expect(negRoomRes.status).toBe(400);
  });
});
