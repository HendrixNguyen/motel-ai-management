import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { ContractTemplateClause } from "./contract.schema";

export const contractTemplateCatalog = pgTable(
  "contract_template_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    clauses: jsonb("clauses").$type<ContractTemplateClause[]>().notNull(),
    active: boolean("active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("contract_template_catalog_key_version_uq").on(t.key, t.version),
    check("contract_template_catalog_key_nonempty", sql`length(trim(${t.key})) > 0`),
    check("contract_template_catalog_version_positive", sql`${t.version} > 0`),
  ],
);
