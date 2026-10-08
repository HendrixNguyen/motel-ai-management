import { foreignKey, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { motels } from "@/modules/motel/motel.schema";
import { helpTickets } from "./ticket.schema";
export const ticketPhotoUploads = pgTable("ticket_photo_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  checksum: text("checksum").notNull(),
  motelId: uuid("motel_id").notNull().references(() => motels.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("ticket_photo_uploads_ticket_id_idx").on(table.ticketId), uniqueIndex("ticket_photo_uploads_object_key_uq").on(table.objectKey), foreignKey({ columns: [table.ticketId, table.motelId], foreignColumns: [helpTickets.id, helpTickets.motelId], name: "ticket_photo_uploads_ticket_motel_fk" })]);
