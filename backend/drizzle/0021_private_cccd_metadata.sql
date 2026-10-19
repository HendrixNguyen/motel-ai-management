ALTER TABLE "renters" RENAME COLUMN "id_card_front_url" TO "legacy_id_card_front_url";
--> statement-breakpoint
ALTER TABLE "renters" RENAME COLUMN "id_card_back_url" TO "legacy_id_card_back_url";
--> statement-breakpoint
ALTER TABLE "renters" ADD COLUMN "id_card_front_object_key" text;
--> statement-breakpoint
ALTER TABLE "renters" ADD COLUMN "id_card_front_content_type" text;
--> statement-breakpoint
ALTER TABLE "renters" ADD COLUMN "id_card_front_size" integer;
--> statement-breakpoint
ALTER TABLE "renters" ADD COLUMN "id_card_front_checksum" text;
--> statement-breakpoint
ALTER TABLE "renters" ADD COLUMN "id_card_back_object_key" text;
--> statement-breakpoint
ALTER TABLE "renters" ADD COLUMN "id_card_back_content_type" text;
--> statement-breakpoint
ALTER TABLE "renters" ADD COLUMN "id_card_back_size" integer;
--> statement-breakpoint
ALTER TABLE "renters" ADD COLUMN "id_card_back_checksum" text;
--> statement-breakpoint
ALTER TABLE "renters" ADD CONSTRAINT "renters_cccd_front_metadata_check" CHECK (("id_card_front_object_key" is null and "id_card_front_content_type" is null and "id_card_front_size" is null and "id_card_front_checksum" is null) or ("id_card_front_object_key" is not null and "id_card_front_content_type" in ('image/jpeg', 'image/png') and "id_card_front_size" between 1 and 5000000 and length(trim("id_card_front_checksum")) > 0));
--> statement-breakpoint
ALTER TABLE "renters" ADD CONSTRAINT "renters_cccd_back_metadata_check" CHECK (("id_card_back_object_key" is null and "id_card_back_content_type" is null and "id_card_back_size" is null and "id_card_back_checksum" is null) or ("id_card_back_object_key" is not null and "id_card_back_content_type" in ('image/jpeg', 'image/png') and "id_card_back_size" between 1 and 5000000 and length(trim("id_card_back_checksum")) > 0));
--> statement-breakpoint
ALTER TABLE "renters" ADD CONSTRAINT "renters_legacy_cccd_not_exposed" CHECK ("legacy_id_card_front_url" is null AND "legacy_id_card_back_url" is null);