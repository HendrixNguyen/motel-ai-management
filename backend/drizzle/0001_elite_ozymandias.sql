ALTER TABLE "contracts" ADD COLUMN "manager_sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "otp_hash" text;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "otp_sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "otp_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "otp_attempts" numeric(1, 0) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "otp_signed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_otp_attempts_range" CHECK ("contracts"."otp_attempts" between 0 and 3);
