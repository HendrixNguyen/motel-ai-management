CREATE TYPE "public"."notification_event_channel" AS ENUM('oa_message', 'zns');--> statement-breakpoint
CREATE TYPE "public"."notification_event_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_failure_class" AS ENUM('transient', 'permanent');--> statement-breakpoint
CREATE TABLE "notification_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_key" text NOT NULL,
  "renter_id" uuid NOT NULL REFERENCES "renters"("id"),
  "motel_id" uuid NOT NULL REFERENCES "motels"("id"),
  "channel" "notification_event_channel" NOT NULL,
  "template_id" text,
  "payload" jsonb NOT NULL,
  "status" "notification_event_status" DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_retry_at" timestamp with time zone,
  "failure_class" "notification_failure_class",
  "failure_reason" text,
  "provider_id" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "notification_events_event_key_uq" ON "notification_events" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "notification_events_renter_id_idx" ON "notification_events" USING btree ("renter_id");--> statement-breakpoint
CREATE INDEX "notification_events_motel_id_idx" ON "notification_events" USING btree ("motel_id");--> statement-breakpoint
CREATE INDEX "notification_events_retry_idx" ON "notification_events" USING btree ("status", "next_retry_at");
