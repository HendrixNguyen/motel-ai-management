import { describe, expect, test } from "bun:test";
import { expiryWindow } from "@/modules/notification/expiry.service";
import { nextExpiryRunAt, runWithAdvisoryLease, runExpirySchedulerOnce, type AdvisoryLeaseDb } from "@/modules/notification/scheduler.service";

describe("expiryWindow", () => {
  test("caps expiry window at 365 days", () => {
    expect(() => expiryWindow(new Date("2026-01-01T00:00:00.000Z"), 366)).toThrow();
  });

  test("preserves exact inclusive upper bound", () => {
    const result = expiryWindow(new Date("2026-01-01T12:30:00.000Z"), 7);
    expect(result.until.toISOString()).toBe("2026-01-08T12:30:00.000Z");
  });
});

describe("nextExpiryRunAt", () => {
  test("schedules next run at 00:05 UTC", () => {
    expect(nextExpiryRunAt(new Date("2026-01-01T00:04:59.000Z")).toISOString()).toBe("2026-01-01T00:05:00.000Z");
    expect(nextExpiryRunAt(new Date("2026-01-01T00:05:00.000Z")).toISOString()).toBe("2026-01-02T00:05:00.000Z");
  });
});

describe("runWithAdvisoryLease", () => {
  test("runs task once and releases lease", async () => {
    const calls: string[] = [];
    const db: AdvisoryLeaseDb = {
      runWithLease: async (key, task) => { calls.push(`acquire:${key}`); const value = await task(); calls.push(`release:${key}`); return { acquired: true, value }; },
    };
    const result = await runWithAdvisoryLease(db, 42, async () => { calls.push("task"); return 7; });
    expect(result).toEqual({ acquired: true, value: 7 });
    expect(calls).toEqual(["acquire:42", "task", "release:42"]);
  });

  test("skips task when another worker owns lease", async () => {
    let ran = false;
    const db: AdvisoryLeaseDb = {
      runWithLease: async () => ({ acquired: false }),
    };
    const result = await runWithAdvisoryLease(db, 42, async () => { ran = true; return 1; });
    expect(result).toEqual({ acquired: false });
    expect(ran).toBe(false);
  });

  test("scheduler uses injected lease and task", async () => {
    const db: AdvisoryLeaseDb = { runWithLease: async (_key, task) => ({ acquired: true, value: await task() }) };
    expect(await runExpirySchedulerOnce({ clock: () => new Date("2026-01-01T00:00:00Z"), leaseDb: db, run: async (now) => { expect(now.toISOString()).toBe("2026-01-01T00:00:00.000Z"); return 3; }, leaseKey: 9 })).toEqual({ acquired: true, count: 3 });
  });

  test("releases lease when task fails", async () => {
    let released = false;
    const db: AdvisoryLeaseDb = {
      runWithLease: async (_key, task) => { try { return { acquired: true, value: await task() }; } finally { released = true; } },
    };
    await expect(runWithAdvisoryLease(db, 42, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(released).toBe(true);
  });
});
