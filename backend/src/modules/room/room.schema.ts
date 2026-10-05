import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { motels } from "@/modules/motel/motel.schema";
import { MONEY_PRECISION } from "@/shared/money";

export const roomStatus = pgEnum("room_status", ["available", "occupied", "maintenance"]);

/**
 * The range of `rooms.floor`, which is `integer` — verified against PostgreSQL as
 * `data_type = 'integer', numeric_precision = 32`, i.e. int4.
 *
 * The bounds are declared here, beside the column, so the route schema that admits a `floor`
 * cannot accept a value the column cannot store. A value outside them is `22003 numeric_value_out
 * of range` at the driver, which the shared handler can only report as a 500.
 *
 * Deliberately the full int4 range rather than `0 .. 2^31-1`: the column stores a negative floor,
 * and nothing in the contract says floors are positive. Tightening that is a business decision,
 * not a column bound, so it is left to whoever owns the rule — `floor` already has `null` for
 * "not recorded".
 */
export const INT4_MIN = -2147483648;
export const INT4_MAX = 2147483647;

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    motelId: uuid("motel_id")
      .notNull()
      .references(() => motels.id),
    /** Room number as displayed, e.g. `P.101`. Unique inside one motel only. */
    name: text("name").notNull(),
    /** Default monthly rent. A signed Contract.monthlyRent always overrides it. */
    basePrice: numeric("base_price", { precision: MONEY_PRECISION, scale: 0 }).notNull().default("0"),
    floor: integer("floor"),
    status: roomStatus("status").notNull().default("available"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rooms_motel_id_idx").on(t.motelId),
    uniqueIndex("rooms_motel_id_name_uq").on(t.motelId, t.name),
  ],
);