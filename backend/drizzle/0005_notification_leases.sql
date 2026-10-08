ALTER TABLE "notification_events" ADD COLUMN "lease_id" uuid;--> statement-breakpoint
ALTER TABLE "notification_events" ADD COLUMN "lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_attempt_count_range" CHECK ("notification_events"."attempt_count" between 0 and 3);
