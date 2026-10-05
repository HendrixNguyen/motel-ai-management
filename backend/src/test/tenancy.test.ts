import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { motels } from "@/modules/motel/motel.schema";
import { registerManager } from "@/modules/auth/auth.service";
import { resolveOwnedMotel } from "@/middleware/tenancy";

// `resetDb` drops the schema and re-applies every migration, which takes seconds — past
// Bun's 5 s default, and worse once a long run has churned the system catalogs.
setDefaultTimeout(20_000);

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
  return { a, owned: owned[0]!, foreign: foreign[0]! };
}

describe("tenant isolation", () => {
  test("a manager resolves their own motel", async () => {
    const { a, owned } = await seedTwoManagers();
    expect((await resolveOwnedMotel(owned.id, a.id)).id).toBe(owned.id);
  });

  test("another manager's motel is 404, never 403", async () => {
    const { a, foreign } = await seedTwoManagers();
    // 404 not 403: a 403 would confirm the motel exists.
    await expect(resolveOwnedMotel(foreign.id, a.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  test("a motel that does not exist is also 404", async () => {
    const { a } = await seedTwoManagers();
    await expect(
      resolveOwnedMotel("00000000-0000-4000-8000-00000000dead", a.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});