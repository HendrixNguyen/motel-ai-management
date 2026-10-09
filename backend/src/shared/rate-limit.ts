import { AppError } from "./errors";

const buckets = new Map<string, { count: number; resetAt: number }>();

export async function enforceRateLimit(key: string, max: number, windowMs = 60_000): Promise<void> {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= max) throw AppError.rateLimited("Thao tác quá nhanh", Math.ceil((current.resetAt - now) / 1000));
  current.count += 1;
}
