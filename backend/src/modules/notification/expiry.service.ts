import { listExpiringContracts } from "@/modules/contract/contract.service";
import { enqueueNotification } from "./notification.service";

export async function enqueueContractExpiryReminders(now = new Date(), windowDays = 7): Promise<number> {
  const until = new Date(now.getTime() + windowDays * 86_400_000);
  const rows = await listExpiringContracts(now, until, windowDays);
  let count = 0;
  for (const contract of rows) {
    await enqueueNotification({ eventKey: contract.eventKey, renterId: contract.renterId, motelId: contract.motelId, templateId: "expiry", payload: { contractId: contract.id, endDate: contract.endDate } });
    count++;
  }
  return count;
}
