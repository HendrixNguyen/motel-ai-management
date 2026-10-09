import { describe, expect, test } from "bun:test";
import { createApp } from "@/app";
import { AppError } from "@/shared/errors";

describe("error envelope", () => {
  test("health check responds without a database round trip", async () => {
    const res = await createApp().handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("an AppError becomes its own status, code, and Vietnamese message", async () => {
    const res = await createApp()
      .get("/boom", () => {
        throw AppError.conflict("Hợp đồng đã tồn tại");
      })
      .handle(new Request("http://localhost/boom"));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Hợp đồng đã tồn tại",
      code: "CONFLICT",
    });
  });

  test("details are returned when the caller can act on them", async () => {
    const res = await createApp()
      .get("/boom", () => {
        throw AppError.badRequest("Dữ liệu sai", { fields: { phone: "Sai định dạng" } });
      })
      .handle(new Request("http://localhost/boom"));

    expect(await res.json()).toEqual({
      error: "Dữ liệu sai",
      code: "VALIDATION_ERROR",
      details: { fields: { phone: "Sai định dạng" } },
    });
  });

  test("an unexpected error is logged without secrets from error or URL", async () => {
    const originalError = console.error;
    const logs: unknown[][] = [];
    console.error = (...args: unknown[]) => logs.push(args);
    try {
      const res = await createApp()
        .get("/boom", () => {
          throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2");
        })
        .handle(new Request("http://localhost/boom?token=magic-secret&safe=1"));

      expect(res.status).toBe(500);
      const body = await res.text();
      expect(JSON.parse(body)).toEqual({
        error: "Đã xảy ra lỗi hệ thống",
        code: "INTERNAL_ERROR",
      });
      expect(body).not.toContain("hunter2");
      expect(body).not.toContain("ECONNREFUSED");
      expect(JSON.stringify(logs)).not.toContain("magic-secret");
      expect(JSON.stringify(logs)).not.toContain("hunter2");
      expect(JSON.stringify(logs)).toContain("[REDACTED]");
    } finally {
      console.error = originalError;
    }
  });

  test("unknown routes return the standard envelope, not Elysia's default text", async () => {
    const res = await createApp().handle(new Request("http://localhost/api/nope"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: expect.any(String),
      code: "NOT_FOUND",
    });
  });

  test("AppError takes its HTTP status from its code, so the pair cannot drift", () => {
    expect(new AppError("READING_CONFLICT", "Xung đột").status).toBe(409);
    expect(new AppError("RATE_LIMITED", "Chậm").status).toBe(429);
    expect(new AppError("EXTERNAL_SERVICE_ERROR", "Zalo lỗi").status).toBe(502);
  });

  test("rateLimited reports the retry delay the caller must wait", async () => {
    const res = await createApp()
      .get("/boom", () => {
        throw AppError.rateLimited("Chờ thêm 60 giây", 60);
      })
      .handle(new Request("http://localhost/boom"));

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      code: "RATE_LIMITED",
      details: { retryAfterSeconds: 60 },
    });
  });
});