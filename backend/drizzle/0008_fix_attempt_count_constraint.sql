ALTER TABLE "notification_events" DROP CONSTRAINT IF EXISTS "notification_events_attempt_count_range";--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_attempt_count_range" CHECK ("notification_events"."attempt_count" between 0 and 3);
