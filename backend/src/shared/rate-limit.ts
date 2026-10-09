import { sql } from "drizzle-orm";
import { db } from "@/db";
import { AppError } from "./errors";

export async function enforceRateLimit(key: string, max: number, windowMs = 60_000): Promise<void> {
  const rows = await db.execute(sql`
    INSERT INTO rate_limit_buckets (key, window_started_at, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE
    SET count = CASE
      WHEN rate_limit_buckets.window_started_at + (${windowMs} * interval '1 millisecond') <= now() THEN 1
      ELSE rate_limit_buckets.count + 1
    END,
    window_started_at = CASE
      WHEN rate_limit_buckets.window_started_at + (${windowMs} * interval '1 millisecond') <= now() THEN now()
      ELSE rate_limit_buckets.window_started_at
    END
    RETURNING count, window_started_at
  `);
  const row = rows[0] as { count: number; window_started_at: Date } | undefined;
  if (!row) throw AppError.externalService("Rate limit store không khả dụng");
  if (row.count > max) throw AppError.rateLimited("Thao tác quá nhanh", Math.ceil((new Date(row.window_started_at).getTime() + windowMs - Date.now()) / 1000));
}
