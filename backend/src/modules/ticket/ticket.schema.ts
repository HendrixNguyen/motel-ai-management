import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export type TicketCategory = "electricity" | "water" | "facilities" | "other";

export const ticketCategory = pgEnum("ticket_category", [
  "electricity",
  "water",
  "facilities",
  "other",
]);

export const ticketStatus = pgEnum("ticket_status", ["open", "in_progress", "resolved"]);

export const helpTickets = pgTable(
  "help_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    renterId: uuid("renter_id").notNull(),
    roomId: uuid("room_id").notNull(),
    motelId: uuid("motel_id").notNull(),
    category: ticketCategory("category").notNull(),
    description: text("description").notNull(),
    /** R2 URLs, at most five. */
    photoUrls: jsonb("photo_urls").$type<string[]>().notNull().default([]),
    status: ticketStatus("status").notNull().default("open"),
    /** Internal only. Never serialised into a renter-facing response. */
    managerNote: text("manager_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("help_tickets_renter_id_idx").on(t.renterId),
    index("help_tickets_motel_id_idx").on(t.motelId),
    check("help_tickets_photo_urls_max_5", sql`jsonb_array_length(${t.photoUrls}) <= 5`),
  ],
);