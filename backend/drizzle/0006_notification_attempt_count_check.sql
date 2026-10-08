ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_attempt_count_range" CHECK ("attempt_count" between 0 and 3);
