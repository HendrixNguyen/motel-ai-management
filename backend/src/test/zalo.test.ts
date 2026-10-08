import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { app } from "@/app";
import { env } from "@/config";

describe("Zalo webhook", () => {
  test("rejects invalid signatures without processing payload", async () => {
    const body = { event_name: "follow", user_id: "oa-user", phone: "84912345678" };
    const response = await app.handle(new Request("http://localhost/api/zalo/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-zalo-signature": "invalid" },
      body: JSON.stringify(body),
    }));
    expect(response.status).toBe(401);
  });

  test("accepts verified follow payload", async () => {
    const body = { event_name: "follow", user_id: "oa-user", phone: "84912345678" };
    const raw = JSON.stringify(body);
    const signature = createHmac("sha256", env.zalo.webhookSecret).update(raw).digest("hex");
    const response = await app.handle(new Request("http://localhost/api/zalo/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-zalo-signature": signature },
      body: raw,
    }));
    expect(response.status).toBe(200);
  });
});
