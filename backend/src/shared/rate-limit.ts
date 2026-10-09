import { AppError } from "@/shared/errors";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;

export function enforceRateLimit(key: string, limit: number, now = Date.now()): void {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (oldest) buckets.delete(oldest);
    }
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (current.count >= limit) {
    throw AppError.rateLimited("Vui lòng thử lại sau", Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
  }
  current.count += 1;
}

export function resetRateLimits(): void {
  buckets.clear();
}
