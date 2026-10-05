import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { sql } from "drizzle-orm";
import { env } from "@/config";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { registerManager } from "@/modules/auth/auth.service";
import { consumeMagicLink, issueMagicLink } from "@/shared/magic-link";
import { app } from "@/app";

// `resetDb` drops the schema and re-applies every migration, which takes seconds — past
// Bun's 5 s default, and worse once a long run has churned the system catalogs.
setDefaultTimeout(20_000);

beforeEach(resetDb);

async function seedRenter() {
  const manager = await registerManager({
    email: "a@example.com", password: "aaaaaaaaaa", name: "A",
  });
  const motel = await db.insert(motels).values({
    managerId: manager.id, name: "M", electricityPrice: "3500", waterPrice: "25000",
  }).returning();
  const renter = await db.insert(renters).values({
    motelId: motel[0]!.id, name: "R", phone: "84901234567",
  }).returning();
  return renter[0]!;
}

describe("magic links", () => {
  test("an issued link resolves to its renter", async () => {
    const renter = await seedRenter();
    const { token } = await issueMagicLink(renter.id);
    expect((await consumeMagicLink(token)).id).toBe(renter.id);
  });

  test("the issued url is the renter portal's /r/[token] landing route", async () => {
    const renter = await seedRenter();
    const { token, url } = await issueMagicLink(renter.id);
    // `/r/<token>` is the only token-bearing route the portal defines. Any other path
    // (it was `/renter/<token>`) 404s on arrival, so every link the manager copies out
    // is dead.
    expect(url).toBe(`${env.frontendUrl}/r/${token}`);
  });

  test("a consumed link cannot be replayed", async () => {
    const renter = await seedRenter();
    const { token } = await issueMagicLink(renter.id);
    await consumeMagicLink(token);
    // Replay must fail: a leaked link must not be reusable.
    await expect(consumeMagicLink(token)).rejects.toMatchObject({
      code: "MAGIC_LINK_EXPIRED",
    });
  });

  test("an unknown token is rejected with the same code as an expired one", async () => {
    await seedRenter();
    await expect(consumeMagicLink("nope")).rejects.toMatchObject({
      code: "MAGIC_LINK_EXPIRED",
    });
  });

  test("an expired link is rejected", async () => {
    const renter = await seedRenter();
    const { token } = await issueMagicLink(renter.id);
    await db.execute(
      sql`UPDATE magic_links SET expires_at = now() - interval '1 hour' WHERE token = ${token}`,
    );
    await expect(consumeMagicLink(token)).rejects.toMatchObject({
      code: "MAGIC_LINK_EXPIRED",
    });
  });

  test("exchange endpoint sets a renter_session cookie", async () => {
    const renter = await seedRenter();
    const { token } = await issueMagicLink(renter.id);
    const res = await app.handle(
      new Request("http://localhost/api/renter/magic-links/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("renter_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
  });
});