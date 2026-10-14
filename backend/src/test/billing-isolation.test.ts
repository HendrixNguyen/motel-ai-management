import { beforeEach, describe, expect, test } from "bun:test";
import { resetDb } from "@/db/test-db";
import { AppError } from "@/shared/errors";
import { app } from "@/app";
import { db } from "@/db";
import { registerManager } from "@/modules/auth/auth.service";
import { motels } from "@/modules/motel/motel.schema";
import { billingPeriods } from "@/modules/billing/billing.schema";

beforeEach(resetDb);
describe("billing isolation", () => {
  test("cross-tenant period access returns 404 over HTTP", async () => {
    await registerManager({ email: "iso@example.com", password: "aaaaaaaaaa", name: "M" });
    const login = await app.handle(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "iso@example.com", password: "aaaaaaaaaa" }) }));
    const cookie = login.headers.get("set-cookie") ?? "";
    const manager = await db.query.managers.findFirst();
    const [otherManager] = await db.insert((await import("@/modules/auth/auth.schema")).managers).values({ email: "other@example.com", passwordHash: "x", name: "O" }).returning();
    const [owned] = await db.insert(motels).values({ managerId: manager!.id, name: "Owned", electricityPrice: "1", waterPrice: "1" }).returning();
    const [other] = await db.insert(motels).values({ managerId: otherManager!.id, name: "Other", electricityPrice: "1", waterPrice: "1" }).returning();
    expect(other).toBeDefined();
    const [period] = await db.insert(billingPeriods).values({ motelId: other!.id, month: 1, year: 2026 }).returning();
    const response = await app.handle(new Request(`http://localhost/api/manager/motels/${owned!.id}/billing/periods/${period!.id}`, { headers: { Cookie: cookie } }));
    expect(response.status).toBe(404);
    expect(AppError.notFound().status).toBe(404);
  });
});
