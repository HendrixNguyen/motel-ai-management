import { listExpiringContracts } from "@/modules/contract/contract.service";
import { enqueueNotification } from "./notification.service";

export interface ExpiryReminderWindow { now: Date; until: Date; windowDays: number; }
export function expiryWindow(now: Date, windowDays: number): ExpiryReminderWindow {
  if (!Number.isInteger(windowDays) || windowDays < 0 || windowDays > 365) throw new Error("Invalid expiry window");
  const until = new Date(now.getTime() + windowDays * 86_400_000);
  return { now, until, windowDays };
}

export async function enqueueContractExpiryReminders(now = new Date(), windowDays = 7): Promise<number> {
  const window = expiryWindow(now, windowDays);
  const rows = await listExpiringContracts(window.now, window.until, window.windowDays);
  let count = 0;
  for (const contract of rows) {
    await enqueueNotification({ eventKey: contract.eventKey, renterId: contract.renterId, motelId: contract.motelId, templateId: "expiry", payload: { contractId: contract.id, endDate: contract.endDate } });
    count++;
  }
  return count;
}
