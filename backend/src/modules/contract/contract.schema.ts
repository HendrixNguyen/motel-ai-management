import {
  boolean,
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
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { rooms } from "@/modules/room/room.schema";

export const contractStatus = pgEnum("contract_status", [
  "draft",
  "active",
  "expired",
  "terminated",
]);

export interface ContractTemplateClause {
  title: string;
  content: string;
}

export const contractTemplateCatalog = pgTable(
  "contract_template_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    clauses: jsonb("clauses").$type<ContractTemplateClause[]>().notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("contract_template_catalog_key_version_uq").on(t.key, t.version),
    check("contract_template_catalog_key_format", sql`${t.key} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("contract_template_catalog_version_positive", sql`${t.version} > 0`),
    check("contract_template_catalog_name_nonempty", sql`length(trim(${t.name})) > 0`),
    check("contract_template_catalog_clauses_array", sql`jsonb_typeof(${t.clauses}) = 'array' AND NOT jsonb_path_exists(${t.clauses}, '$[*] ? (@.title.type() != "string" || @.content.type() != "string" || @.title == "" || @.content == "")')`),
  ],
);

export const contractTemplates = pgTable(
  "contract_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    motelId: uuid("motel_id")
      .notNull()
      .references(() => motels.id),
    name: text("name").notNull(),
    clauses: jsonb("clauses").$type<ContractTemplateClause[]>().notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contract_templates_motel_id_idx").on(t.motelId),
    // At most one default template per motel.
    uniqueIndex("contract_templates_default_uq")
      .on(t.motelId)
      .where(sql`${t.isDefault}`),
  ],
);

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    renterId: uuid("renter_id")
      .notNull()
      .references(() => renters.id),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id),
    motelId: uuid("motel_id")
      .notNull()
      .references(() => motels.id),
    templateId: uuid("template_id").references(() => contractTemplates.id),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    monthlyRent: numeric("monthly_rent", { precision: 14, scale: 0 }).notNull(),
    deposit: numeric("deposit", { precision: 14, scale: 0 }).notNull().default("0"),
    /** Snapshot of the template's clauses at contract creation. */
    clauses: jsonb("clauses").$type<ContractTemplateClause[]>().notNull().default([]),
    acceptedTermsVersion: text("accepted_terms_version"),
    acceptedTermsSnapshot: jsonb("accepted_terms_snapshot").$type<Record<string, unknown> | null>(),
    consentMethod: text("consent_method"),
    consentAcceptedAt: timestamp("consent_accepted_at", { withTimezone: true }),
    managerSentAt: timestamp("manager_sent_at", { withTimezone: true }),
    otpSentAt: timestamp("otp_sent_at", { withTimezone: true }),
    otpHash: text("otp_hash"),
    otpExpiresAt: timestamp("otp_expires_at", { withTimezone: true }),
    otpAttempts: numeric("otp_attempts", { precision: 1, scale: 0 }).notNull().default("0"),
    otpSignedAt: timestamp("otp_signed_at", { withTimezone: true }),

    status: contractStatus("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contracts_renter_id_idx").on(t.renterId),
    index("contracts_room_id_idx").on(t.roomId),
    index("contracts_motel_id_idx").on(t.motelId),
    // A room has at most one live contract; history stays queryable.
    uniqueIndex("contracts_room_active_uq")
      .on(t.roomId)
      .where(sql`${t.status} = 'active'`),
    check("contracts_end_after_start", sql`${t.endDate} > ${t.startDate}`),
    check("contracts_otp_attempts_range", sql`${t.otpAttempts} between 0 and 3`),
    check(
      "contracts_consent_evidence_complete",
      sql`(${t.consentMethod} is null and ${t.acceptedTermsVersion} is null and ${t.acceptedTermsSnapshot} is null and ${t.consentAcceptedAt} is null) or (${t.consentMethod} = 'session_consent' and ${t.acceptedTermsVersion} is not null and ${t.acceptedTermsSnapshot} is not null and ${t.consentAcceptedAt} is not null)`,
    ),
  ],
);
