import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { contracts, contractTemplates } from "@/modules/contract/contract.schema";

setDefaultTimeout(20_000);
beforeEach(resetDb);
const PASSWORD = "aaaaaaaaaa";

async function login(email: string) {
  await registerManager({ email, password: PASSWORD, name: email });
  const res = await app.handle(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) }));
  return res.headers.get("set-cookie") ?? "";
}
async function api(method: string, path: string, cookie: string, body?: unknown) {
  return app.handle(new Request(`http://localhost/api${path}`, { method, headers: { "Content-Type": "application/json", Cookie: cookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
}
async function createMotel(managerId: string) {
  const [row] = await db.insert(motels).values({ managerId, name: "Motel", electricityPrice: "1", waterPrice: "2" }).returning();
  return row!;
}

describe("contract templates", () => {
  test("creates and lists clauses with default false", async () => {
    const cookie = await login("a@example.com");
    const me = await api("GET", "/auth/me", cookie);
    const manager = (await me.json()) as { id: string };
    const motel = await createMotel(manager.id);
    const created = await api("POST", `/manager/motels/${motel.id}/contract-templates`, cookie, { name: "Mẫu", clauses: [{ title: "Tiền", content: "Đủ" }] });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ name: "Mẫu", isDefault: false, clauses: [{ title: "Tiền", content: "Đủ" }] });
  });

  test("setting default clears prior default and validates input", async () => {
    const cookie = await login("b@example.com");
    const me = await api("GET", "/auth/me", cookie);
    const manager = (await me.json()) as { id: string };
    const motel = await createMotel(manager.id);
    const first = await api("POST", `/manager/motels/${motel.id}/contract-templates`, cookie, { name: "Một", clauses: [], isDefault: true });
    const firstBody = (await first.json()) as { id: string };
    const second = await api("POST", `/manager/motels/${motel.id}/contract-templates`, cookie, { name: "Hai", clauses: [], isDefault: true });
    expect(second.status).toBe(201);
    expect((await db.query.contractTemplates.findFirst({ where: (t, { eq }) => eq(t.id, firstBody.id) }))!.isDefault).toBe(false);
    const bad = await api("POST", `/manager/motels/${motel.id}/contract-templates`, cookie, { name: " ", clauses: [{ title: "", content: "x" }] });
    expect(bad.status).toBe(400);
  });

  test("hides other manager motel and refuses referenced deletion", async () => {
    const owner = await login("c@example.com");
    const other = await login("d@example.com");
    const me = await api("GET", "/auth/me", owner);
    const manager = (await me.json()) as { id: string };
    const motel = await createMotel(manager.id);
    const denied = await api("GET", `/manager/motels/${motel.id}/contract-templates`, other);
    expect(denied.status).toBe(404);
    const created = await api("POST", `/manager/motels/${motel.id}/contract-templates`, owner, { name: "Mẫu", clauses: [] });
    const template = (await created.json()) as { id: string };
    const [room] = await db.insert(rooms).values({ motelId: motel.id, name: "101", basePrice: "1" }).returning();
    const [renter] = await db.insert(renters).values({ motelId: motel.id, name: "Người thuê", phone: "84901234567" }).returning();
    await db.insert(contracts).values({ motelId: motel.id, renterId: renter!.id, roomId: room!.id, templateId: template.id, startDate: "2026-01-01", endDate: "2026-02-01", monthlyRent: "1" });
    const deleted = await api("DELETE", `/manager/motels/${motel.id}/contract-templates/${template.id}`, owner);
    expect(deleted.status).toBe(409);
  });
});
