import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { type VndString } from "@/shared/money";
import { billingPeriods, invoices } from "./billing.schema";

export async function countBillingPeriodsForMotel(motelId: string): Promise<number> {
  return db.$count(billingPeriods, eq(billingPeriods.motelId, motelId));
}

export interface RecentInvoice {
  id: string;
  billingPeriodId: string;
  totalAmount: VndString;
  paymentStatus: "unpaid" | "paid" | "overdue";
  /** ISO-8601 UTC string on the wire. */
  createdAt: string;
}

/**
 * A renter's invoices, newest first, capped at `limit`.
 *
 * `limit` is the caller's decision, not this module's: how much history belongs on a screen is a
 * property of that screen. An empty list is a normal answer — a renter who has not been billed
 * yet is not an error.
 *
 * The ordering falls back to `id` so two invoices written in the same microsecond still come back
 * in a fixed order; a caller paginating this would otherwise see the same row twice.
 */
export async function listRecentInvoicesForRenter(
  renterId: string,
  limit: number,
): Promise<RecentInvoice[]> {
  const rows = await db.query.invoices.findMany({
    where: eq(invoices.renterId, renterId),
    orderBy: [desc(invoices.createdAt), desc(invoices.id)],
    limit,
  });

  // `createdAt` is a `timestamptz` and the contract asks for ISO-8601 UTC on the wire. Spelling
  // that out here is what lets `RecentInvoice.createdAt` be a `string`: `numeric` handing back a
  // JS number for `totalAmount` would fail this return type instead of slipping through.
  return rows.map((row) => ({
    id: row.id,
    billingPeriodId: row.billingPeriodId,
    totalAmount: row.totalAmount,
    paymentStatus: row.paymentStatus,
    createdAt: row.createdAt.toISOString(),
  }));
}