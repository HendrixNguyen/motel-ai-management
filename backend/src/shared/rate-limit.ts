import { AppError } from "@/shared/errors";
import { db } from "@/db";
import { sql } from "drizzle-orm";

type Bucket = { count: number; resetAt: number };
const localBuckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;
const sharedStore = process.env.RATE_LIMIT_STORE ?? (process.env.NODE_ENV === "production" ? "postgres" : "local");

export async function enforceRateLimit(key: string, limit: number, now = Date.now()): Promise<void> {
  if (sharedStore === "local") return enforceLocalRateLimit(key, limit, now);
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const [row] = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limit_buckets (bucket_key, window_start, request_count)
    VALUES (${key}, to_timestamp(${windowStart / 1000}), 1)
    ON CONFLICT (bucket_key, window_start)
    DO UPDATE SET request_count = rate_limit_buckets.request_count + 1
    RETURNING request_count AS count
  `);
  const count = Number(row?.count ?? 0);
  if (count > limit) throw AppError.rateLimited("Vui lòng thử lại sau", Math.max(1, Math.ceil((windowStart + WINDOW_MS - now) / 1000)));
}

function enforceLocalRateLimit(key: string, limit: number, now: number): void {
  const current = localBuckets.get(key);
  if (!current || current.resetAt <= now) {
    if (localBuckets.size >= MAX_BUCKETS) localBuckets.delete(localBuckets.keys().next().value!);
    localBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (current.count >= limit) throw AppError.rateLimited("Vui lòng thử lại sau", Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
  current.count += 1;
}

export function resetRateLimits(): void { localBuckets.clear(); }
