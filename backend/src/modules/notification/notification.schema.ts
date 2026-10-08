import {
  integer,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";

export const notificationEventChannel = pgEnum("notification_event_channel", ["oa_message", "zns"]);
export const notificationEventStatus = pgEnum("notification_event_status", ["pending", "sent", "failed"]);
export const notificationFailureClass = pgEnum("notification_failure_class", ["transient", "permanent"]);

export const notificationEvents = pgTable(
  "notification_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventKey: text("event_key").notNull(),
    renterId: uuid("renter_id").notNull().references(() => renters.id),
    motelId: uuid("motel_id").notNull().references(() => motels.id),
    channel: notificationEventChannel("channel").notNull(),
    templateId: text("template_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: notificationEventStatus("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    failureClass: notificationFailureClass("failure_class"),
    failureReason: text("failure_reason"),
    providerId: text("provider_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("notification_events_event_key_uq").on(table.eventKey),
    index("notification_events_renter_id_idx").on(table.renterId),
    index("notification_events_motel_id_idx").on(table.motelId),
    index("notification_events_retry_idx").on(table.status, table.nextRetryAt),
  ],
);
