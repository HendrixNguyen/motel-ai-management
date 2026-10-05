import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { managers } from "@/modules/auth/auth.schema";

export interface MotelFee {
  name: string;
  /** VND, whole units. Stored as a JSON string so no value ever becomes a float. */
  amount: string;
}

export interface BankAccount {
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

/**
 * Digits `numeric(14,0)` holds: the largest storable amount is `10^14 - 1`.
 *
 * Declared once and used by the column *and* by the service's magnitude check, so the bound
 * cannot drift from the column it protects. Verified against PostgreSQL:
 * `numeric_precision = 14, numeric_scale = 0` for `electricity_price` and `water_price`.
 */
export const MONEY_PRECISION = 14;

export const motels = pgTable(
  "motels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    managerId: uuid("manager_id")
      .notNull()
      .references(() => managers.id),
    name: text("name").notNull(),
    address: text("address"),
    /** VND per kWh. */
    electricityPrice: numeric("electricity_price", {
      precision: MONEY_PRECISION,
      scale: 0,
    }).notNull(),
    /** VND per m3. */
    waterPrice: numeric("water_price", { precision: MONEY_PRECISION, scale: 0 }).notNull(),
    otherFees: jsonb("other_fees")
      .$type<MotelFee[]>()
      .notNull()
      .default([]),
    bankAccount: jsonb("bank_account").$type<BankAccount | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("motels_manager_id_idx").on(t.managerId)],
);