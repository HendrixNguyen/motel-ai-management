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

export const roomStatus = pgEnum("room_status", ["available", "occupied", "maintenance"]);

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
    basePrice: numeric("base_price", { precision: 14, scale: 0 }).notNull().default("0"),
    floor: integer("floor"),
    status: roomStatus("status").notNull().default("available"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rooms_motel_id_idx").on(t.motelId),
    uniqueIndex("rooms_motel_id_name_uq").on(t.motelId, t.name),
  ],
);