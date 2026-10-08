import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
export const ticketPhotoUploads = pgTable("ticket_photo_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  checksum: text("checksum").notNull(),
  motelId: uuid("motel_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("ticket_photo_uploads_ticket_id_idx").on(table.ticketId), uniqueIndex("ticket_photo_uploads_object_key_uq").on(table.objectKey)]);
