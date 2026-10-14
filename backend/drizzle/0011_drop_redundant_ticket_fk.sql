-- Remove redundant single-column FK; composite FK in 0010 enforces ticket and motel scope together.
ALTER TABLE "ticket_photo_uploads" DROP CONSTRAINT "ticket_photo_uploads_ticket_id_help_tickets_id_fk";
