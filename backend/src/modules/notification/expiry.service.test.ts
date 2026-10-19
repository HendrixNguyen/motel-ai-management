import { describe, expect, mock, test } from "bun:test";
mock.module("@/modules/contract/contract.service", () => ({ listExpiringContracts: async (now: Date, until: Date, days: number) => {
  if (days === 2) return [{ id: "one", renterId: "r1", motelId: "m1", eventKey: "expiry:one", endDate: "2026-10-20" }, { id: "two", renterId: "r2", motelId: "m2", eventKey: "expiry:two", endDate: "2026-10-20" }];
  return [];
} }));
const queued: unknown[] = [];
mock.module("./notification.service", () => ({ enqueueNotification: async (item: unknown) => { queued.push(item); } }));
import { enqueueContractExpiryReminders, expiryWindow } from "./expiry.service";

describe("contract expiry reminders", () => {
  test("validates window days and uses exact millisecond boundaries", () => {
    const now = new Date("2026-10-01T00:00:00.000Z");
    expect(expiryWindow(now, 0).until.toISOString()).toBe(now.toISOString());
    expect(expiryWindow(now, 365).until.getTime() - now.getTime()).toBe(365 * 86_400_000);
    for (const days of [-1, 366, 1.5]) expect(() => expiryWindow(now, days)).toThrow("Invalid expiry window");
  });
  test("queues reminder payloads and returns number of scheduled rows", async () => {
    queued.length = 0;
    const count = await enqueueContractExpiryReminders(new Date("2026-10-01T00:00:00Z"), 2);
    expect(count).toBe(2);
    expect(queued).toEqual([
      { eventKey: "expiry:one", renterId: "r1", motelId: "m1", templateId: "expiry", payload: { contractId: "one", endDate: "2026-10-20" } },
      { eventKey: "expiry:two", renterId: "r2", motelId: "m2", templateId: "expiry", payload: { contractId: "two", endDate: "2026-10-20" } },
    ]);
  });
  test("empty expiry list queues nothing", async () => {
    queued.length = 0;
    expect(await enqueueContractExpiryReminders(new Date("2026-10-01T00:00:00Z"), 7)).toBe(0);
    expect(queued).toEqual([]);
  });
});
