ALTER TABLE "contracts" ADD COLUMN "accepted_terms_version" text;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "accepted_terms_snapshot" jsonb;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "consent_method" text;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "consent_accepted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_consent_evidence_complete" CHECK ((consent_method is null and accepted_terms_version is null and accepted_terms_snapshot is null and consent_accepted_at is null) or (consent_method = 'session_consent' and accepted_terms_version is not null and accepted_terms_snapshot is not null and consent_accepted_at is not null));
--> statement-breakpoint
ALTER TABLE "notification_events" ALTER COLUMN "channel" SET DATA TYPE text;
--> statement-breakpoint
DROP TYPE "public"."notification_event_channel";
--> statement-breakpoint
CREATE TYPE "public"."notification_event_channel" AS ENUM('zns');
--> statement-breakpoint
ALTER TABLE "notification_events" ALTER COLUMN "channel" SET DATA TYPE "public"."notification_event_channel" USING "channel"::"public"."notification_event_channel";
