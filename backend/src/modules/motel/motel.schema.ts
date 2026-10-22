import {
  check,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { managers } from "@/modules/auth/auth.schema";
import { sql } from "drizzle-orm";
import { MONEY_PRECISION } from "@/shared/money";

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

export const motels = pgTable(
  "motels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicAccessCode: text("public_access_code").notNull().default(sql`replace(encode(gen_random_bytes(24), 'base64'), '/', '_')`).unique(),
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
  (t) => [index("motels_manager_id_idx").on(t.managerId), check("motels_public_access_code_nonempty", sql`length(trim(${t.publicAccessCode})) >= 20`)],
);