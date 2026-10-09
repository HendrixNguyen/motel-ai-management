import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { motels, type MotelFee } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { rooms } from "@/modules/room/room.schema";

export const billingPeriodStatus = pgEnum("billing_period_status", ["draft", "sent", "closed"]);

export const meterType = pgEnum("meter_type", ["electric", "water"]);

export const paymentStatus = pgEnum("payment_status", ["unpaid", "paid", "overdue"]);
export const paymentMethod = pgEnum("payment_method", ["bank_transfer", "cash"]);

export const billingPeriods = pgTable(
  "billing_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    motelId: uuid("motel_id")
      .notNull()
      .references(() => motels.id),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    status: billingPeriodStatus("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("billing_periods_motel_id_idx").on(t.motelId),
    uniqueIndex("billing_periods_motel_month_year_uq").on(t.motelId, t.month, t.year),
    check("billing_periods_month_range", sql`${t.month} between 1 and 12`),
  ],
);

export const meterReadings = pgTable(
  "meter_readings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id),
    billingPeriodId: uuid("billing_period_id")
      .notNull()
      .references(() => billingPeriods.id),
    type: meterType("type").notNull(),
    /** Seeded from the prior period so a missing reading is visible, not silently zero. */
    previousReading: numeric("previous_reading", { precision: 12, scale: 2 }).notNull(),
    /** Null until the manager submits it. */
    currentReading: numeric("current_reading", { precision: 12, scale: 2 }),
    /** R2 URL of the meter at reading time. Captured by the offline-first PWA. */
    photoUrl: text("photo_url"),
    readingDate: date("reading_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Bumped on every accepted write so a stale offline write can be detected. */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("meter_readings_room_id_idx").on(t.roomId),
    index("meter_readings_billing_period_id_idx").on(t.billingPeriodId),
    uniqueIndex("meter_readings_period_room_type_uq").on(t.billingPeriodId, t.roomId, t.type),
    // A meter never runs backwards. Null means "not read yet", which is legal.
    check(
      "meter_readings_current_gte_previous",
      sql`${t.currentReading} is null or ${t.currentReading} >= ${t.previousReading}`,
    ),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingPeriodId: uuid("billing_period_id")
      .notNull()
      .references(() => billingPeriods.id),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id),
    renterId: uuid("renter_id")
      .notNull()
      .references(() => renters.id),
    motelId: uuid("motel_id")
      .notNull()
      .references(() => motels.id),
    /** Snapshot of the active contract's monthlyRent. */
    rentAmount: numeric("rent_amount", { precision: 14, scale: 0 }).notNull(),
    electricityUsage: numeric("electricity_usage", { precision: 12, scale: 2 }).notNull(),
    electricityCost: numeric("electricity_cost", { precision: 14, scale: 0 }).notNull(),
    waterUsage: numeric("water_usage", { precision: 12, scale: 2 }).notNull(),
    waterCost: numeric("water_cost", { precision: 14, scale: 0 }).notNull(),
    /** Snapshot of the motel's otherFees, so a later edit never changes a sent bill. */
    otherFees: jsonb("other_fees")
      .$type<MotelFee[]>()
      .notNull()
      .default([]),
    totalAmount: numeric("total_amount", { precision: 14, scale: 0 }).notNull(),
    /** VietQR payload string. */
    qrCodeData: text("qr_code_data"),
    paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
    paymentMethod: paymentMethod("payment_method"),
    paymentProofId: uuid("payment_proof_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invoices_billing_period_id_idx").on(t.billingPeriodId),
    index("invoices_renter_id_idx").on(t.renterId),
    index("invoices_motel_id_idx").on(t.motelId),
    // One invoice per room per period. Regeneration replaces the row.
     uniqueIndex("invoices_period_room_uq").on(t.billingPeriodId, t.roomId),
     uniqueIndex("invoices_id_renter_motel_uq").on(t.id, t.renterId, t.motelId),

  ],
);