import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { managers } from "./auth.schema";

export const renterLoginRequests = pgTable("renter_login_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  motelId: uuid("motel_id").notNull().references(() => motels.id, { onDelete: "cascade" }),
  renterId: uuid("renter_id").notNull().references(() => renters.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  handledByManagerId: uuid("handled_by_manager_id").references(() => managers.id),
}, (table) => [
  index("renter_login_requests_motel_status_idx").on(table.motelId, table.status, table.requestedAt),
  uniqueIndex("renter_login_requests_pending_owner_uq").on(table.motelId, table.renterId).where(sql`${table.status} = 'pending'`),
  check("renter_login_requests_status_check", sql`${table.status} in ('pending', 'handled', 'dismissed')`),
  check("renter_login_requests_handled_fields_check", sql`(${table.status} = 'pending' and ${table.handledAt} is null and ${table.handledByManagerId} is null) or (${table.status} <> 'pending' and ${table.handledAt} is not null and ${table.handledByManagerId} is not null)`),
]);
