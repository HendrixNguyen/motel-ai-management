import { afterEach, describe, expect, test } from "bun:test";
import { AppError } from "@/shared/errors";
import { enforceRateLimit, resetRateLimits } from "@/shared/rate-limit";

afterEach(resetRateLimits);

describe("rate limiting", () => {
  test("rejects requests over configured limit", async () => {
    await enforceRateLimit("ip:one", 2, 1000);
    await enforceRateLimit("ip:one", 2, 1000);
    await expect(enforceRateLimit("ip:one", 2, 1000)).rejects.toThrow(AppError);
  });
});

