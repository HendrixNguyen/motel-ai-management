import { eq } from "drizzle-orm";
import { db } from "@/db";
import { billingPeriods } from "./billing.schema";

export async function countBillingPeriodsForMotel(motelId: string): Promise<number> {
  return db.$count(billingPeriods, eq(billingPeriods.motelId, motelId));
}