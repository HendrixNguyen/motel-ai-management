-- Add motel scope and enforce ticket/attachment tenant consistency.
ALTER TABLE "ticket_photo_uploads" ADD COLUMN "motel_id" uuid;
--> statement-breakpoint
UPDATE "ticket_photo_uploads" AS p SET "motel_id" = t."motel_id" FROM "help_tickets" AS t WHERE t."id" = p."ticket_id";
--> statement-breakpoint
ALTER TABLE "ticket_photo_uploads" ALTER COLUMN "motel_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ticket_photo_uploads" ADD CONSTRAINT "ticket_photo_uploads_motel_id_motels_id_fk" FOREIGN KEY ("motel_id") REFERENCES "public"."motels"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_id_motel_id_uq" UNIQUE ("id", "motel_id");
--> statement-breakpoint
ALTER TABLE "ticket_photo_uploads" ADD CONSTRAINT "ticket_photo_uploads_ticket_motel_fk" FOREIGN KEY ("ticket_id", "motel_id") REFERENCES "public"."help_tickets"("id", "motel_id") ON DELETE no action ON UPDATE no action;
