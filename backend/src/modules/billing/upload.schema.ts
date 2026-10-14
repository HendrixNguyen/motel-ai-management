import { index, pgTable, text, timestamp, uniqueIndex, uuid, integer } from "drizzle-orm/pg-core";
import { motels } from "@/modules/motel/motel.schema";

export const uploads = pgTable("uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id").notNull(),
  motelId: uuid("motel_id").notNull().references(() => motels.id),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  checksum: text("checksum").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uploads_resource_type_id_uq").on(t.resourceType, t.resourceId),
  uniqueIndex("uploads_object_key_uq").on(t.objectKey),
  index("uploads_motel_id_idx").on(t.motelId),
]);
