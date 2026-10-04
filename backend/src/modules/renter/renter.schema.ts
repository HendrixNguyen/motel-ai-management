import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";

export const renterStatus = pgEnum("renter_status", ["active", "inactive"]);

export const notificationChannel = pgEnum("notification_channel", ["oa_message", "zns"]);

export const notificationStatus = pgEnum("notification_status", ["pending", "sent", "failed"]);

export const renters = pgTable(
  "renters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    motelId: uuid("motel_id")
      .notNull()
      .references(() => motels.id),
    name: text("name").notNull(),
    /** Identity key. Normalised to `84XXXXXXXXX` by shared/phone before insert. */
    phone: text("phone").notNull(),
    /** CCCD number. */
    idNumber: text("id_number"),
    idCardFrontUrl: text("id_card_front_url"),
    idCardBackUrl: text("id_card_back_url"),
    /** Null while the renter has not been assigned a room. */
    roomId: uuid("room_id").references(() => rooms.id),
    /** Set by the OA follow webhook. */
    zaloOaId: text("zalo_oa_id"),
    isOaFollower: boolean("is_oa_follower").notNull().default(false),
    status: renterStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("renters_motel_id_idx").on(t.motelId),
    index("renters_room_id_idx").on(t.roomId),
    // Phone identifies a renter within one motel, never across the whole system.
    uniqueIndex("renters_motel_id_phone_uq").on(t.motelId, t.phone),
    check("renters_phone_normalised", sql`${t.phone} ~ '^84[0-9]{9}$'`),
  ],
);

export const zaloNotifications = pgTable(
  "zalo_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    renterId: uuid("renter_id")
      .notNull()
      .references(() => renters.id),
    motelId: uuid("motel_id")
      .notNull()
      .references(() => motels.id),
    channel: notificationChannel("channel").notNull(),
    /** Null for OA messages, which have no template. */
    templateId: text("template_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: notificationStatus("status").notNull().default("pending"),
    failureReason: text("failure_reason"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("zalo_notifications_renter_id_idx").on(t.renterId),
    index("zalo_notifications_motel_id_idx").on(t.motelId),
  ],
);