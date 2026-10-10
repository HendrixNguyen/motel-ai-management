CREATE TABLE "rate_limit_buckets" (
  "key" text PRIMARY KEY,
  "window_started_at" timestamp with time zone NOT NULL,
  "count" integer NOT NULL,
  CONSTRAINT "rate_limit_buckets_count_check" CHECK ("count" > 0)
);
