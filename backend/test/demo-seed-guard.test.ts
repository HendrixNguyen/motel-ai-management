import { beforeEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { seedData } from "@/db/seed";
import { assertDemoSeedAllowed } from "@/db/seed";

setDefaultTimeout(120_000);

beforeEach(resetDb);

describe("demo seed QA guard", () => {
  it.each([
    ["production APP_ENV", { APP_ENV: "production", SEED_DATABASE: "true" }],
    ["staging APP_ENV", { APP_ENV: "staging", SEED_DATABASE: "true" }],
    ["unset APP_ENV", { SEED_DATABASE: "true" }],
    ["QA without opt-in", { APP_ENV: "qa" }],
    ["non-QA mode", { APP_ENV: "development", SEED_DATABASE: "true" }],
  ])("refuses %s before changing existing data", async (_label, overrides) => {
    await db.insert(managers).values({
      email: "existing@example.com",
      name: "Existing manager",
      passwordHash: "existing-hash",
    });
    await db.insert(motels).values({ managerId: (await db.select({ id: managers.id }).from(managers))[0]!.id, name: "Existing motel", address: "Existing address", electricityPrice: "3000", waterPrice: "15000" });
    const managersBefore = await db.select().from(managers);
    const motelsBefore = await db.select().from(motels);
    const roomsBefore = await db.select().from(rooms);
    const rentersBefore = await db.select().from(renters);
    await expect(seedDataWithEnv(overrides)).rejects.toThrow("APP_ENV=qa");
    expect(await db.select().from(managers)).toEqual(managersBefore);
    expect(await db.select().from(motels)).toEqual(motelsBefore);
    expect(await db.select().from(rooms)).toEqual(roomsBefore);
    expect(await db.select().from(renters)).toEqual(rentersBefore);
  });

  it("allows only explicit QA opt-in", () => {
    expect(() => assertDemoSeedAllowed({ NODE_ENV: "production", APP_ENV: "qa", SEED_DATABASE: "true" })).not.toThrow();
    expect(() => assertDemoSeedAllowed({ APP_ENV: "qa", SEED_DATABASE: "true" })).not.toThrow();
  });

  it("retains deterministic seed behavior in QA with opt-in", async () => {
    await seedDataWithEnv({ NODE_ENV: "production", APP_ENV: "qa", SEED_DATABASE: "true" });
    expect(await db.select().from(managers)).toHaveLength(1);
    expect(await db.select().from(motels)).toHaveLength(1);
    await seedDataWithEnv({ APP_ENV: "qa", SEED_DATABASE: "true" });
    expect(await db.select().from(managers)).toHaveLength(1);
    expect(await db.select().from(motels)).toHaveLength(1);
  });
});

async function seedDataWithEnv(env: NodeJS.ProcessEnv) {
  const original = { NODE_ENV: process.env.NODE_ENV, APP_ENV: process.env.APP_ENV, SEED_DATABASE: process.env.SEED_DATABASE };
  for (const key of ["NODE_ENV", "APP_ENV", "SEED_DATABASE"] as const) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key]!;
  }
  try {
    return await seedData();
  } finally {
    for (const key of ["NODE_ENV", "APP_ENV", "SEED_DATABASE"] as const) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key]!;
    }
  }
}
