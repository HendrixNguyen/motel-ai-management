ALTER TABLE "contracts" ALTER COLUMN "clauses" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
UPDATE "contracts" SET "clauses" = '[]'::jsonb WHERE "clauses" IS NULL;
--> statement-breakpoint
ALTER TABLE "contracts" ALTER COLUMN "clauses" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "manager_sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "otp_hash" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'otp_sent_at'
  ) THEN
    ALTER TABLE "contracts" ADD COLUMN "otp_sent_at" timestamp with time zone;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "otp_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "otp_attempts" numeric(1, 0) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_otp_attempts_range" CHECK ("contracts"."otp_attempts" between 0 and 3);
