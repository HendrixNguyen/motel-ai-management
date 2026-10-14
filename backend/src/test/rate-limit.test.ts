import { afterEach, describe, expect, test } from "bun:test";
import { AppError } from "@/shared/errors";
import { enforceRateLimit, resetRateLimits } from "@/shared/rate-limit";

afterEach(resetRateLimits);

describe("rate limiting", () => {
  test("postgres integration requires explicit store and database", async () => {
    if (process.env.RATE_LIMIT_STORE !== "postgres") return;
    await enforceRateLimit("integration", 1);
    await expect(enforceRateLimit("integration", 1)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  test("rejects requests over configured limit", async () => {
    await enforceRateLimit("ip:one", 2, 1000);
    await enforceRateLimit("ip:one", 2, 1000);
    await expect(enforceRateLimit("ip:one", 2, 1000)).rejects.toThrow(AppError);
  });
});

