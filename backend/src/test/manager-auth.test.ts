import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { app } from "@/app";
import { db } from "@/db";
import { managers } from "@/modules/auth/auth.schema";
import { registerManager, verifyManager } from "@/modules/auth/auth.service";
import { createApp } from "@/app";
import { resetDb } from "@/db/test-db";

// `resetDb` drops the schema and re-applies every migration, which takes seconds — past
// Bun's 5 s default, and worse once a long run has churned the system catalogs.
setDefaultTimeout(20_000);

beforeEach(resetDb);

const valid = { email: "a@example.com", password: "correct horse battery", name: "A" };

describe("manager auth", () => {
  test("register stores a hash, not the password", async () => {
    const row = await registerManager(valid);
    expect(row.passwordHash).not.toContain(valid.password);
    expect(row.email).toBe("a@example.com");
  });

  test("register lowercases the email", async () => {
    const row = await registerManager({ ...valid, email: "MiXeD@Example.COM" });
    expect(row.email).toBe("mixed@example.com");
  });

  test("register rejects a duplicate email with CONFLICT", async () => {
    await registerManager(valid);
    await expect(registerManager(valid)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("register rejects a password under 8 characters", async () => {
    await expect(registerManager({ ...valid, password: "short" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  test("verify accepts an Argon2id hash from seed data", async () => {
    await db.insert(managers).values({
      email: valid.email,
      passwordHash: await Bun.password.hash(valid.password, { algorithm: "argon2id" }),
      name: valid.name,
    });
    expect((await verifyManager(valid.email, valid.password)).id).toBeDefined();
  });

  test("verify rejects a wrong password with UNAUTHORIZED", async () => {
    await registerManager(valid);
    await expect(verifyManager(valid.email, "wrong password")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("login rejects an unknown email the same way", async () => {
    await expect(verifyManager("nobody@example.com", "whatever")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("authorization bearer header cannot authenticate manager routes", async () => {
    const response = await createApp().handle(new Request("http://localhost/api/auth/me", { headers: { authorization: "Bearer forged" } }));
    expect(response.status).toBe(401);
  });

  test("spoofed X-Forwarded-For does not change untrusted client bucket", async () => {
    const first = await createApp().handle(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "1.1.1.1" }, body: JSON.stringify({ email: "nobody@example.com", password: "bad" }) }));
    const second = await createApp().handle(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "2.2.2.2" }, body: JSON.stringify({ email: "nobody@example.com", password: "bad" }) }));
    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
  });

  test("unknown email performs password verification against a dummy hash", async () => {
    const original = Bun.password.verify;
    let calls = 0;
    Bun.password.verify = (async (...args: Parameters<typeof Bun.password.verify>) => {
      calls += 1;
      return original(...args);
    }) as typeof Bun.password.verify;
    try {
      await expect(verifyManager("nobody@example.com", "whatever")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(calls).toBe(1);
    } finally {
      Bun.password.verify = original;
    }
  });
});
