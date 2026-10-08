ALTER TABLE "notification_events" ADD COLUMN "lease_id" uuid;--> statement-breakpoint
ALTER TABLE "notification_events" ADD COLUMN "lease_until" timestamp with time zone;--> statement-breakpoint
