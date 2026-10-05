import { beforeEach, describe, expect, test } from "bun:test";
import { app } from "@/app";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { registerManager, verifyManager } from "@/modules/auth/auth.service";
import { consumeMagicLink, issueMagicLink } from "@/shared/magic-link";

beforeEach(resetDb);

async function seedTwoManagers() {
  const a = await registerManager({ email: "a@example.com", password: "aaaaaaaaaa", name: "A" });
  const b = await registerManager({ email: "b@example.com", password: "bbbbbbbbbb", name: "B" });
  const owned = await db.insert(motels).values({
    managerId: a.id, name: "Owned", electricityPrice: "3500", waterPrice: "25000",
  }).returning();
  const foreign = await db.insert(motels).values({
    managerId: b.id, name: "Foreign", electricityPrice: "3500", waterPrice: "25000",
  }).returning();
  return { a, b, owned: owned[0]!, foreign: foreign[0]! };
}

async function loginAndGetCookie(manager: { id: string; email: string; name: string }) {
  const res = await app.handle(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: manager.email, password: "aaaaaaaaaa" }),
    }),
  );
  const setCookie = res.headers.get("set-cookie");
  return setCookie;
}

describe("cross-tenant isolation over HTTP", () => {
  test("manager A cannot access manager B's motel via API", async () => {
    const { a, b, owned, foreign } = await seedTwoManagers();
    const cookieA = await loginAndGetCookie(a);

    // Try to access foreign motel (should be 404)
    const res = await app.handle(
      new Request(`http://localhost/api/motels/${foreign.id}`, {
        headers: { Cookie: cookieA ?? "" },
      }),
    );
    expect(res.status).toBe(404);
  });

  test("manager A cannot access manager B's rooms via API", async () => {
    const { a, b, owned, foreign } = await seedTwoManagers();
    const cookieA = await loginAndGetCookie(a);
    const room = await db.insert(rooms).values({ motelId: foreign.id, name: "P.201" }).returning();

    const res = await app.handle(
      new Request(`http://localhost/api/rooms/${room[0]!.id}`, {
        headers: { Cookie: cookieA ?? "" },
      }),
    );
    expect(res.status).toBe(404);
  });

  test("renter A cannot access renter B's data by guessing id", async () => {
    const { a, owned } = await seedTwoManagers();
    const room = await db.insert(rooms).values({ motelId: owned.id, name: "P.101" }).returning();
    const renter = await db.insert(renters).values({
      motelId: owned.id, name: "R", phone: "84901234567", roomId: room[0]!.id,
    }).returning();

    const { token } = await issueMagicLink(renter[0]!.id);
    await consumeMagicLink(token);

    // Try to access a protected renter endpoint with invalid session
    const res = await app.handle(
      new Request(`http://localhost/api/renter/magic-links/resend`, {
        method: "POST",
        headers: { Cookie: "renter_session=invalid" },
      }),
    );
    expect(res.status).toBe(401);
  });

  test("magic link replay is rejected", async () => {
    const { owned } = await seedTwoManagers();
    const room = await db.insert(rooms).values({ motelId: owned.id, name: "P.101" }).returning();
    const renter = await db.insert(renters).values({
      motelId: owned.id, name: "R", phone: "84901234567", roomId: room[0]!.id,
    }).returning();

    const { token } = await issueMagicLink(renter[0]!.id);
    await consumeMagicLink(token);

    // Replay should fail
    const res = await app.handle(
      new Request("http://localhost/api/renter/magic-links/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("MAGIC_LINK_EXPIRED");
  });
});