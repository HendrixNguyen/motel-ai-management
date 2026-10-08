CREATE TABLE "ticket_photo_uploads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL,
  "motel_id" uuid NOT NULL,
  "object_key" text NOT NULL,
  "content_type" text NOT NULL,
  "size" integer NOT NULL,
  "checksum" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_photo_uploads" ADD CONSTRAINT "ticket_photo_uploads_ticket_id_help_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."help_tickets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_photo_uploads" ADD CONSTRAINT "ticket_photo_uploads_motel_id_motels_id_fk" FOREIGN KEY ("motel_id") REFERENCES "public"."motels"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ticket_photo_uploads_ticket_id_idx" ON "ticket_photo_uploads" USING btree ("ticket_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_photo_uploads_object_key_uq" ON "ticket_photo_uploads" USING btree ("object_key");
