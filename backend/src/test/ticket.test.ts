import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { registerManager } from "@/modules/auth/auth.service";
import { helpTickets } from "@/modules/ticket/ticket.schema";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { issueMagicLink } from "@/shared/magic-link";
import { FakeStorageAdapter } from "@/shared/storage";
import { configureTicketStorage } from "@/modules/ticket/ticket.service";

setDefaultTimeout(20_000);
beforeEach(async () => { await resetDb(); configureTicketStorage(new FakeStorageAdapter()); });

async function seed(email = "ticket@example.com") {
  const manager = await registerManager({ email, password: "aaaaaaaa", name: "Manager" });
  const [motel] = await db.insert(motels).values({ managerId: manager.id, name: email, electricityPrice: "1", waterPrice: "2" }).returning();
  const [room] = await db.insert(rooms).values({ motelId: motel!.id, name: "101" }).returning();
  const [renter] = await db.insert(renters).values({ motelId: motel!.id, roomId: room!.id, name: "Renter", phone: "84901234567" }).returning();
  const { token } = await issueMagicLink(renter!.id);
  const exchange = await app.handle(new Request("http://localhost/api/renter/magic-links/exchange", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }));
  return { motel: motel!, room: room!, renter: renter!, cookie: exchange.headers.get("set-cookie")!.split(";", 1)[0]! };
}

function json(method: string, path: string, cookie: string, body?: unknown) {
  return app.handle(new Request(`http://localhost${path}`, { method, headers: { cookie, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
}

describe("renter tickets", () => {
  test("creates and lists own ticket without manager note or private object keys", async () => {
    const data = await seed();
    const created = await json("POST", "/api/renter/tickets", data.cookie, { category: "facilities", description: "Nước rò rỉ trong phòng" });
    expect(created.status).toBe(201);
    const body = await created.json() as Record<string, unknown>;
    expect(body).toMatchObject({ renterId: data.renter.id, motelId: data.motel.id, category: "facilities", status: "open", photoUrls: [] });
    expect(body).not.toHaveProperty("managerNote");
    expect(body).not.toHaveProperty("objectKey");
    const listed = await json("GET", "/api/renter/tickets", data.cookie);
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual([expect.objectContaining({ id: body.id })]);
  });

  test("rejects foreign ticket and invalid descriptions", async () => {
    const own = await seed("own-ticket@example.com");
    const foreign = await seed("foreign-ticket@example.com");
    const created = await json("POST", "/api/renter/tickets", foreign.cookie, { category: "water", description: "Nước không có" });
    const ticketId = (await created.json() as { id: string }).id;
    expect((await json("GET", `/api/renter/tickets/${ticketId}`, own.cookie)).status).toBe(404);
    expect((await json("POST", "/api/renter/tickets", own.cookie, { category: "water", description: "ngắn" })).status).toBe(400);
  });

  test("limits attachments and rejects invalid files", async () => {
    const data = await seed("files-ticket@example.com");
    const files = Array.from({ length: 6 }, () => new File([new Uint8Array([0xff, 0xd8, 0xff])], "x.jpg", { type: "image/jpeg" }));
    const tooMany = new FormData(); tooMany.set("category", "other"); tooMany.set("description", "Mô tả sự cố đủ dài"); files.forEach((file) => tooMany.append("photos", file));
    expect((await app.handle(new Request("http://localhost/api/renter/tickets", { method: "POST", headers: { cookie: data.cookie }, body: tooMany }))).status).toBe(400);
    const bad = new FormData(); bad.set("category", "other"); bad.set("description", "Mô tả sự cố đủ dài"); bad.append("photos", new File([new Uint8Array([1, 2, 3])], "x.jpg", { type: "image/jpeg" }));
    expect((await app.handle(new Request("http://localhost/api/renter/tickets", { method: "POST", headers: { cookie: data.cookie }, body: bad }))).status).toBe(400);
  });

  test("malformed JSON returns validation error", async () => {
    const data = await seed("malformed-ticket@example.com");
    const response = await app.handle(new Request("http://localhost/api/renter/tickets", { method: "POST", headers: { cookie: data.cookie, "content-type": "application/json" }, body: "{" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Dữ liệu gửi lên không hợp lệ", code: "VALIDATION_ERROR" });
  });

  test("ticket remains created when notification provider fails", async () => {
    const data = await seed("notify-ticket@example.com");
    const response = await json("POST", "/api/renter/tickets", data.cookie, { category: "electricity", description: "Điện chập chờn trong phòng" });
    expect(response.status).toBe(201);
    expect(await db.query.helpTickets.findFirst({ where: eq(helpTickets.renterId, data.renter.id) })).toBeDefined();
  });
});
