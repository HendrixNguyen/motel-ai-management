import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { contracts } from "@/modules/contract/contract.schema";
import { enqueueNotification } from "./notification.service";

export async function enqueueContractExpiryReminders(now = new Date(), windowDays = 7): Promise<number> {
  const until = new Date(now.getTime() + windowDays * 86_400_000);
  const rows = await db.query.contracts.findMany({ where: and(eq(contracts.status, "active"), lte(contracts.endDate, until.toISOString().slice(0, 10))) });
  let count = 0;
  for (const contract of rows) {
    await enqueueNotification({ eventKey: `contract:${contract.id}:expiry:${contract.endDate}:${windowDays}`, renterId: contract.renterId, motelId: contract.motelId, templateId: "expiry", payload: { contractId: contract.id, endDate: contract.endDate } });
    count++;
  }
  return count;
}
