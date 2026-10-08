CREATE TABLE "zalo_oa_motel_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "oa_id" text NOT NULL,
  "motel_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "zalo_oa_motel_mappings" ADD CONSTRAINT "zalo_oa_motel_mappings_oa_id_nonempty" CHECK (length(trim("oa_id")) > 0);--> statement-breakpoint
ALTER TABLE "zalo_oa_motel_mappings" ADD CONSTRAINT "zalo_oa_motel_mappings_motel_id_uuid" CHECK ("motel_id" is not null);--> statement-breakpoint
CREATE UNIQUE INDEX "zalo_oa_motel_mappings_oa_id_uq" ON "zalo_oa_motel_mappings" USING btree ("oa_id");--> statement-breakpoint
CREATE INDEX "zalo_oa_motel_mappings_motel_id_idx" ON "zalo_oa_motel_mappings" USING btree ("motel_id");
