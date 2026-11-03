import { check, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { managers } from "@/modules/auth/auth.schema";
import { motels } from "./motel.schema";
import { contractTemplates } from "@/modules/contract/contract.schema";

export const motelSetupRequests = pgTable(
  "motel_setup_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    managerId: uuid("manager_id")
      .notNull()
      .references(() => managers.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    motelId: uuid("motel_id").references(() => motels.id, { onDelete: "set null" }),
    templateId: uuid("template_id").references(() => contractTemplates.id, {
      onDelete: "set null",
    }),
    mode: text("mode").notNull(),
    roomCount: integer("room_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("motel_setup_requests_manager_request_uq").on(t.managerId, t.requestId),
    check("motel_setup_requests_mode_check", sql`${t.mode} IN ('full', 'quick')`),
    check(
      "motel_setup_requests_room_count_check",
      sql`(${t.mode} = 'full' AND ${t.roomCount} >= 1 AND ${t.roomCount} <= 100) OR (${t.mode} = 'quick' AND ${t.roomCount} = 0)`,
    ),
  ],
);
