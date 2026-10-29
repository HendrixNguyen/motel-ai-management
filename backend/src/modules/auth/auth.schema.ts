import { check, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { renters } from "@/modules/renter/renter.schema";

export const managerRole = pgEnum("manager_role", ["manager", "superadmin"]);

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
    role: managerRole("role").notNull().default("manager"),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    sessionVersion: integer("session_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("managers_email_lowercase", sql`${t.email} = lower(${t.email})`),
    check("managers_session_version_nonnegative", sql`${t.sessionVersion} >= 0`),
    uniqueIndex("managers_single_superadmin_uq").on(sql`(true)`).where(sql`${t.role} = 'superadmin'`),
  ],
);

/**
 * Single-use login links for the renter portal. `consumedAt` is what makes a replay
 * detectable: a second exchange of the same token finds it already consumed.
 */
export const managerAuditEvents = pgTable("manager_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").notNull().references(() => managers.id),
  targetId: uuid("target_id").notNull().references(() => managers.id),
  action: text("action").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const magicLinks = pgTable(
  "magic_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    renterId: uuid("renter_id")
      .notNull()
      .references(() => renters.id),
    /** SHA-256 digest of the random one-time token. */
    tokenHash: text("token_hash").notNull().unique(),
    /** createdAt + 24h. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Set on first exchange. */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("magic_links_renter_id_idx").on(t.renterId),
    index("magic_links_expires_at_idx").on(t.expiresAt),
    check("magic_links_token_hash_format", sql`${t.tokenHash} ~ '^[a-f0-9]{64}$'`),
  ],
);
