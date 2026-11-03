import {
  check,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { motels } from "@/modules/motel/motel.schema";

export const monthlyUtilityCosts = pgTable(
  "monthly_utility_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    motelId: uuid("motel_id")
      .notNull()
      .references(() => motels.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    electricityAmount: numeric("electricity_amount", { precision: 14, scale: 0 }),
    waterAmount: numeric("water_amount", { precision: 14, scale: 0 }),
    electricityNotes: text("electricity_notes"),
    waterNotes: text("water_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("monthly_utility_costs_motel_year_month_uq").on(t.motelId, t.year, t.month),
    check("monthly_utility_costs_month_range", sql`${t.month} between 1 and 12`),
    check("monthly_utility_costs_year_range", sql`${t.year} between 1 and 9999`),
    check(
      "monthly_utility_costs_electricity_nonnegative",
      sql`${t.electricityAmount} is null or ${t.electricityAmount} >= 0`,
    ),
    check(
      "monthly_utility_costs_water_nonnegative",
      sql`${t.waterAmount} is null or ${t.waterAmount} >= 0`,
    ),
    check(
      "monthly_utility_costs_electricity_notes_length",
      sql`${t.electricityNotes} is null or char_length(${t.electricityNotes}) <= 2000`,
    ),
    check(
      "monthly_utility_costs_water_notes_length",
      sql`${t.waterNotes} is null or char_length(${t.waterNotes}) <= 2000`,
    ),
  ],
);
