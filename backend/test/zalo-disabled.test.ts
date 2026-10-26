import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { notificationRoutes } from "@/modules/notification/notification.route";

describe("Zalo webhook without integration config", () => {
  test("hides webhook before signature processing with 404 when Zalo OA is disabled", async () => {
    const response = await new Elysia().use(notificationRoutes).handle(
      new Request("http://localhost/webhooks/zalo", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Không tìm thấy", code: "NOT_FOUND" });
  });
});
