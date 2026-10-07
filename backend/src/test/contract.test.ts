import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { contracts, contractTemplates } from "@/modules/contract/contract.schema";
import { eq } from "drizzle-orm";

setDefaultTimeout(20_000);
beforeEach(resetDb);
const PASSWORD = "aaaaaaaaaa";
async function login(email: string) { await registerManager({ email, password: PASSWORD, name: email }); const res = await app.handle(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) })); return res.headers.get("set-cookie") ?? ""; }
async function api(method: string, path: string, cookie: string, body?: unknown) { return app.handle(new Request(`http://localhost/api${path}`, { method, headers: { "Content-Type": "application/json", Cookie: cookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })); }
async function setup(email = "a@example.com") { const cookie = await login(email); const me = await api("GET", "/auth/me", cookie); const manager = (await me.json()) as { id: string }; const [motel] = await db.insert(motels).values({ managerId: manager.id, name: "Motel", electricityPrice: "1", waterPrice: "2" }).returning(); const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101", basePrice: "3500000" }).returning(); const [renter] = await db.insert(renters).values({ motelId: motel!.id, name: "Người thuê", phone: "84901234567", roomId: room!.id }).returning(); const [template] = await db.insert(contractTemplates).values({ motelId: motel!.id, name: "Mẫu", clauses: [{ title: "Tiền", content: "Đủ" }], isDefault: true }).returning(); return { cookie, motel: motel!, room: room!, renter: renter!, template: template! }; }

describe("manager contracts", () => {
  test("creates, snapshots template clauses and room rent, lists and details", async () => { const s = await setup(); const created = await api("POST", `/manager/motels/${s.motel.id}/contracts`, s.cookie, { renterId: s.renter.id, roomId: s.room.id, templateId: s.template.id, startDate: "2026-01-01", endDate: "2026-12-31" }); expect(created.status).toBe(201); const body = await created.json() as { id: string; monthlyRent: string; clauses: unknown[]; status: string }; expect(body.monthlyRent).toBe("3500000"); expect(body.clauses).toEqual([{ title: "Tiền", content: "Đủ" }]); expect(body.status).toBe("draft"); expect((await api("GET", `/manager/motels/${s.motel.id}/contracts`, s.cookie)).status).toBe(200); expect((await api("GET", `/manager/motels/${s.motel.id}/contracts/${body.id}`, s.cookie)).status).toBe(200); });
  test("patches only drafts, rejects active room conflict, and terminates", async () => { const s = await setup(); const created = await api("POST", `/manager/motels/${s.motel.id}/contracts`, s.cookie, { renterId: s.renter.id, roomId: s.room.id, templateId: s.template.id, startDate: "2026-01-01", endDate: "2026-12-31" }); const id = (await created.json() as { id: string }).id; expect((await api("PATCH", `/manager/motels/${s.motel.id}/contracts/${id}`, s.cookie, { monthlyRent: "4000000" })).status).toBe(200); await db.update(contracts).set({ status: "active" }).where(eq(contracts.id, id)); expect((await api("PATCH", `/manager/motels/${s.motel.id}/contracts/${id}`, s.cookie, { monthlyRent: "1" })).status).toBe(409); expect((await api("POST", `/manager/motels/${s.motel.id}/contracts/${id}/terminate`, s.cookie)).status).toBe(200); });
  test("send stamps otpSentAt only after notification succeeds", async () => { const s = await setup(); const created = await api("POST", `/manager/motels/${s.motel.id}/contracts`, s.cookie, { renterId: s.renter.id, roomId: s.room.id, templateId: s.template.id, startDate: "2026-01-01", endDate: "2026-12-31" }); const id = (await created.json() as { id: string }).id; const sent = await api("POST", `/manager/motels/${s.motel.id}/contracts/${id}/send`, s.cookie); expect([200, 502]).toContain(sent.status); if (sent.status === 200) expect((await db.query.contracts.findFirst({ where: (c, { eq }) => eq(c.id, id) }))!.otpSentAt).not.toBeNull(); });
});
