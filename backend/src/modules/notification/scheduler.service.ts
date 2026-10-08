import { sql } from "drizzle-orm";
import { db } from "@/db";

export interface AdvisoryLeaseDb {
  tryAdvisoryLock(key: number): Promise<boolean>;
  releaseAdvisoryLock(key: number): Promise<void>;
}

export const postgresAdvisoryLeaseDb: AdvisoryLeaseDb = {
  async tryAdvisoryLock(key) {
    const result = await db.execute(sql`select pg_try_advisory_lock(${key}) as acquired`);
    return Boolean(result[0]?.acquired);
  },
  async releaseAdvisoryLock(key) {
    await db.execute(sql`select pg_advisory_unlock(${key})`);
  },
};

export async function runWithAdvisoryLease<T>(leaseDb: AdvisoryLeaseDb, key: number, task: () => Promise<T>): Promise<{ acquired: true; value: T } | { acquired: false }> {
  if (!(await leaseDb.tryAdvisoryLock(key))) return { acquired: false };
  try {
    return { acquired: true, value: await task() };
  } finally {
    await leaseDb.releaseAdvisoryLock(key);
  }
}

export function nextExpiryRunAt(now: Date): Date {
  const next = new Date(now);
  next.setUTCHours(0, 5, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export interface ExpirySchedulerDeps {
  clock?: () => Date;
  leaseDb?: AdvisoryLeaseDb;
  run?: (now: Date) => Promise<number>;
  leaseKey?: number;
}

export async function runExpirySchedulerOnce({ clock = () => new Date(), leaseDb = postgresAdvisoryLeaseDb, run, leaseKey = 8_417_203 }: ExpirySchedulerDeps): Promise<{ acquired: boolean; count?: number }> {
  if (!run) throw new Error("Expiry scheduler task is required");
  const result = await runWithAdvisoryLease(leaseDb, leaseKey, () => run(clock()));
  return result.acquired ? { acquired: true, count: result.value } : { acquired: false };
}
