import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { renters } from "@/modules/renter/renter.schema";

export const managers = pgTable(
  "managers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Lowercase. `managers_email_lowercase` makes that a database fact, not a habit. */
    email: text("email").notNull().unique(),
    /** argon2id. */
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("managers_email_lowercase", sql`${t.email} = lower(${t.email})`)],
);

/**
 * Single-use login links for the renter portal. `consumedAt` is what makes a replay
 * detectable: a second exchange of the same token finds it already consumed.
 */
export const magicLinks = pgTable(
  "magic_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    renterId: uuid("renter_id")
      .notNull()
      .references(() => renters.id),
    /** 32 crypto-random bytes, base62. Unique, so a lookup is an index hit. */
    token: text("token").notNull().unique(),
    /** createdAt + 24h. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Set on first exchange. */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("magic_links_renter_id_idx").on(t.renterId),
    index("magic_links_expires_at_idx").on(t.expiresAt),
  ],
);