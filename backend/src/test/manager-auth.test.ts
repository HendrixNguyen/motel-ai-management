import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { app } from "@/app";
import { registerManager, verifyManager } from "@/modules/auth/auth.service";
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

  test("verify accepts the right password", async () => {
    await registerManager(valid);
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
});