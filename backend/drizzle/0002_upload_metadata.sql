CREATE TABLE "uploads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" uuid NOT NULL,
  "motel_id" uuid NOT NULL REFERENCES "motels"("id"),
  "object_key" text NOT NULL,
  "content_type" text NOT NULL,
  "size" integer NOT NULL,
  "checksum" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uploads_resource_type_id_uq" ON "uploads" USING btree ("resource_type", "resource_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uploads_object_key_uq" ON "uploads" USING btree ("object_key");
--> statement-breakpoint
CREATE INDEX "uploads_motel_id_idx" ON "uploads" USING btree ("motel_id");
