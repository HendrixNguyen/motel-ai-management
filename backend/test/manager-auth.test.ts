import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resetRateLimits } from "@/shared/rate-limit";
import { managers } from "@/modules/auth/auth.schema";
import { SUPERADMIN_EMAIL } from "@/modules/auth/superadmin-identity";
import { adminAccountRoutes } from "@/modules/auth/auth.route";
import { verifyManager } from "@/modules/auth/auth.service";
import { app, createApp } from "@/app";
import { resetDb } from "@/db/test-db";

// `resetDb` drops the schema and re-applies every migration, which takes seconds — past
// Bun's 5 s default, and worse once a long run has churned the system catalogs.
setDefaultTimeout(20_000);

beforeEach(async () => {
  resetRateLimits();
  await resetDb();
});

const valid = { email: "a@example.com", password: "correct horse battery", name: "A" };

async function loginSession(email: string, password: string) {
  const response = await createApp().handle(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  const body = (await response.json()) as { csrfToken?: string };
  const cookieHeader = response.headers.get("set-cookie")!;
  return {
    cookie: cookieHeader.split(";")[0]!,
    rawToken: cookieHeader.match(/manager_session=([^;]+)/)![1]!,
    csrfToken: body.csrfToken ?? "",
  };
}

async function testSessionCookie(email: string, password: string) {
  return (await loginSession(email, password)).cookie;
}

describe("manager auth", () => {
  test("public manager registration remains available and only creates manager role", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "public@example.com",
          name: "Public Manager",
          password: "abcdefgh",
          role: "superadmin",
        }),
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ email: "public@example.com" });
    expect(
      await db.query.managers.findFirst({ where: eq(managers.email, "public@example.com") }),
    ).toMatchObject({ role: "manager" });
  });

  test("public registration rejects reserved Superadmin email, including mixed case", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "SuPeRaDmIn@Motel.Huyndg.Io.Vn",
          name: "Impersonator",
          password: "password 123",
        }),
      }),
    );
    expect([400, 409, 422]).toContain(response.status);
    expect(
      await db.query.managers.findFirst({ where: eq(managers.email, SUPERADMIN_EMAIL) }),
    ).toBeUndefined();
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
    await db.insert(managers).values({
      email: valid.email,
      passwordHash: await Bun.password.hash(valid.password, { algorithm: "argon2id" }),
      name: valid.name,
    });
    await expect(verifyManager(valid.email, "wrong password")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("login rejects an unknown email the same way", async () => {
    await expect(verifyManager("nobody@example.com", "whatever")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("superadmin session remains valid on me and logout endpoints", async () => {
    const [root] = await db
      .insert(managers)
      .values({
        email: "root@example.com",
        passwordHash: await Bun.password.hash("root password 123", { algorithm: "argon2id" }),
        name: "Root",
        role: "superadmin",
      })
      .returning();
    const { cookie, csrfToken } = await loginSession(root!.email, "root password 123");
    const me = await createApp().handle(
      new Request("http://localhost/api/auth/me", { headers: { cookie } }),
    );
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ email: root!.email, role: "superadmin" });
    expect(csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const repeated = await loginSession(root!.email, "root password 123");
    expect(repeated.csrfToken).not.toBe(csrfToken);
    const list = await createApp().handle(
      new Request("http://localhost/api/admin/managers?limit=50&offset=0", { headers: { cookie } }),
    );
    expect(list.status).toBe(200);
    expect(list.headers.get("x-csrf-token")).toBe(csrfToken);
    const business = await createApp().handle(
      new Request("http://localhost/api/manager/motels", { headers: { cookie } }),
    );
    expect(business.status).toBe(403);
    const logout = await createApp().handle(
      new Request("http://localhost/api/auth/logout", { method: "POST", headers: { cookie } }),
    );
    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie")).toContain("manager_session=");
  });

  test("superadmin cannot use manager business endpoints", async () => {
    const [root] = await db
      .insert(managers)
      .values({
        email: "root@example.com",
        passwordHash: await Bun.password.hash("root password 123", { algorithm: "argon2id" }),
        name: "Root",
        role: "superadmin",
      })
      .returning();
    const { cookie } = await loginSession(root!.email, "root password 123");
    const response = await createApp().handle(
      new Request("http://localhost/api/manager/motels", { headers: { cookie } }),
    );
    expect(response.status).toBe(403);
  });

  test("manager cannot access superadmin accounts", async () => {
    await db.insert(managers).values({
      email: valid.email,
      passwordHash: await Bun.password.hash(valid.password, { algorithm: "argon2id" }),
      name: valid.name,
    });
    const cookie = await testSessionCookie(valid.email, valid.password);
    const response = await createApp().handle(
      new Request("http://localhost/api/admin/managers?limit=50&offset=0", { headers: { cookie } }),
    );
    expect(response.status).toBe(403);
  });

  test("superadmin can list managers and receive a session-bound CSRF token", async () => {
    const [root] = await db
      .insert(managers)
      .values({
        email: "root@example.com",
        passwordHash: await Bun.password.hash("root password 123", { algorithm: "argon2id" }),
        name: "Root",
        role: "superadmin",
      })
      .returning();
    const { cookie, csrfToken } = await loginSession(root!.email, "root password 123");
    expect(csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const response = await createApp().handle(
      new Request("http://localhost/api/admin/managers?limit=50&offset=0", { headers: { cookie } }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-csrf-token")).toBe(csrfToken);
    expect(csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await response.json()).toEqual([]);
  });

  test("Superadmin provisioning rejects its reserved email", async () => {
    const [root] = await db
      .insert(managers)
      .values({
        email: "root@example.com",
        passwordHash: await Bun.password.hash("root password 123", { algorithm: "argon2id" }),
        name: "Root",
        role: "superadmin",
      })
      .returning();
    const { cookie, csrfToken } = await loginSession(root!.email, "root password 123");
    const response = await createApp().handle(
      new Request("http://localhost/api/admin/managers", {
        method: "POST",
        headers: { cookie, "x-csrf-token": csrfToken, "content-type": "application/json" },
        body: JSON.stringify({
          email: SUPERADMIN_EMAIL,
          name: "Impersonator",
          password: "secure password 123",
        }),
      }),
    );
    expect([400, 409, 422]).toContain(response.status);
    expect(
      await db.query.managers.findFirst({ where: eq(managers.email, SUPERADMIN_EMAIL) }),
    ).toBeUndefined();
  });

  test("superadmin creates manager with a direct password and manager can log in immediately", async () => {
    const [root] = await db
      .insert(managers)
      .values({
        email: "root@example.com",
        passwordHash: await Bun.password.hash("root password 123", { algorithm: "argon2id" }),
        name: "Root",
        role: "superadmin",
      })
      .returning();
    const { cookie, csrfToken: csrf } = await loginSession(root!.email, "root password 123");
    const createdResponse = await createApp().handle(
      new Request("http://localhost/api/admin/managers", {
        method: "POST",
        headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
        body: JSON.stringify({
          email: "new@example.com",
          name: "New Manager",
          password: "manager password 123",
        }),
      }),
    );
    expect(createdResponse.status).toBe(201);
    const createdBody = await createdResponse.json();
    expect(createdBody).not.toHaveProperty("passwordHash");
    const managerCookie = await testSessionCookie("new@example.com", "manager password 123");
    const me = await createApp().handle(
      new Request("http://localhost/api/auth/me", { headers: { cookie: managerCookie } }),
    );
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ email: "new@example.com", role: "manager" });
  });

  test("manager password reset revokes prior sessions", async () => {
    const [root] = await db
      .insert(managers)
      .values({
        email: "root@example.com",
        passwordHash: await Bun.password.hash("root password 123", { algorithm: "argon2id" }),
        name: "Root",
        role: "superadmin",
      })
      .returning();
    const { cookie: rootCookie, csrfToken: csrf } = await loginSession(
      root!.email,
      "root password 123",
    );
    const created = await createApp().handle(
      new Request("http://localhost/api/admin/managers", {
        method: "POST",
        headers: { cookie: rootCookie, "x-csrf-token": csrf, "content-type": "application/json" },
        body: JSON.stringify({
          email: "reset@example.com",
          name: "Reset",
          password: "old password 123",
        }),
      }),
    );
    const manager = (await created.json()) as { id: string };
    const oldCookie = await testSessionCookie("reset@example.com", "old password 123");
    const response = await createApp().handle(
      new Request(`http://localhost/api/admin/managers/${manager.id}/reset-password`, {
        method: "POST",
        headers: { cookie: rootCookie, "x-csrf-token": csrf, "content-type": "application/json" },
        body: JSON.stringify({ password: "new password 123" }),
      }),
    );
    expect(response.status).toBe(200);
    const stale = await createApp().handle(
      new Request("http://localhost/api/auth/me", { headers: { cookie: oldCookie } }),
    );
    expect(stale.status).toBe(401);
    await expect(testSessionCookie("reset@example.com", "new password 123")).resolves.toContain(
      "manager_session=",
    );
  });

  test("manager passwords shorter than eight characters are rejected", async () => {
    const [root] = await db
      .insert(managers)
      .values({
        email: "root@example.com",
        passwordHash: await Bun.password.hash("root password 123", { algorithm: "argon2id" }),
        name: "Root",
        role: "superadmin",
      })
      .returning();
    const { cookie, csrfToken: csrf } = await loginSession(root!.email, "root password 123");
    const response = await createApp().handle(
      new Request("http://localhost/api/admin/managers", {
        method: "POST",
        headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
        body: JSON.stringify({ email: "short@example.com", name: "Short", password: "short" }),
      }),
    );
    expect([400, 422]).toContain(response.status);
  });

  test("admin mutations require current CSRF token", async () => {
    const [root] = await db
      .insert(managers)
      .values({
        email: "root@example.com",
        passwordHash: await Bun.password.hash("root password 123", { algorithm: "argon2id" }),
        name: "Root",
        role: "superadmin",
      })
      .returning();
    const { cookie } = await loginSession(root!.email, "root password 123");
    const response = await createApp().handle(
      new Request("http://localhost/api/admin/managers", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          email: "new@example.com",
          name: "New",
          password: "new password 123",
        }),
      }),
    );
    expect(response.status).toBe(403);
  });

  test("admin mutation rejects stale CSRF token", async () => {
    const [root] = await db
      .insert(managers)
      .values({
        email: "root@example.com",
        passwordHash: await Bun.password.hash("root password 123", { algorithm: "argon2id" }),
        name: "Root",
        role: "superadmin",
      })
      .returning();
    const { cookie, csrfToken: csrf } = await loginSession(root!.email, "root password 123");
    await db.update(managers).set({ sessionVersion: 1 }).where(eq(managers.id, root!.id));
    const response = await createApp().handle(
      new Request("http://localhost/api/admin/managers", {
        method: "POST",
        headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
        body: JSON.stringify({
          email: "new@example.com",
          name: "New",
          password: "new password 123",
        }),
      }),
    );
    expect(response.status).toBe(401);
  });

  test("authorization bearer header cannot authenticate manager routes", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/api/auth/me", { headers: { authorization: "Bearer forged" } }),
    );
    expect(response.status).toBe(401);
  });

  test("spoofed X-Forwarded-For does not change untrusted client bucket", async () => {
    const first = await createApp().handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "1.1.1.1" },
        body: JSON.stringify({ email: "nobody@example.com", password: "bad" }),
      }),
    );
    const second = await createApp().handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "2.2.2.2" },
        body: JSON.stringify({ email: "nobody@example.com", password: "bad" }),
      }),
    );
    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
  });

  test("rejects malformed login input", async () => {
    const badLogin = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect([400, 422]).toContain(badLogin.status);
  });

  test("unknown email performs password verification against a dummy hash", async () => {
    const original = Bun.password.verify;
    let calls = 0;
    Bun.password.verify = (async (...args: Parameters<typeof Bun.password.verify>) => {
      calls += 1;
      return original(...args);
    }) as typeof Bun.password.verify;
    try {
      await expect(verifyManager("nobody@example.com", "whatever")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      expect(calls).toBe(1);
    } finally {
      Bun.password.verify = original;
    }
  });
});
