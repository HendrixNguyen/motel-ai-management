CREATE TYPE "public"."billing_period_status" AS ENUM('draft', 'sent', 'closed');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'active', 'expired', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."meter_type" AS ENUM('electric', 'water');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('oa_message', 'zns');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'paid', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."renter_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('available', 'occupied', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('electricity', 'water', 'facilities', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TABLE "billing_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"motel_id" uuid NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"status" "billing_period_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_periods_month_range" CHECK ("billing_periods"."month" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "contract_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"motel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"clauses" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"renter_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"motel_id" uuid NOT NULL,
	"template_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"monthly_rent" numeric(14, 0) NOT NULL,
	"deposit" numeric(14, 0) DEFAULT '0' NOT NULL,
	"clauses" jsonb,
	"otp_sent_at" timestamp with time zone,
	"otp_signed_at" timestamp with time zone,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_end_after_start" CHECK ("contracts"."end_date" > "contracts"."start_date")
);
--> statement-breakpoint
CREATE TABLE "help_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"renter_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"motel_id" uuid NOT NULL,
	"category" "ticket_category" NOT NULL,
	"description" text NOT NULL,
	"photo_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"manager_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "help_tickets_photo_urls_max_5" CHECK (jsonb_array_length("help_tickets"."photo_urls") <= 5)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_period_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"renter_id" uuid NOT NULL,
	"motel_id" uuid NOT NULL,
	"rent_amount" numeric(14, 0) NOT NULL,
	"electricity_usage" numeric(12, 2) NOT NULL,
	"electricity_cost" numeric(14, 0) NOT NULL,
	"water_usage" numeric(12, 2) NOT NULL,
	"water_cost" numeric(14, 0) NOT NULL,
	"other_fees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_amount" numeric(14, 0) NOT NULL,
	"qr_code_data" text,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"renter_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magic_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "managers_email_unique" UNIQUE("email"),
	CONSTRAINT "managers_email_lowercase" CHECK ("managers"."email" = lower("managers"."email"))
);
--> statement-breakpoint
CREATE TABLE "meter_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"billing_period_id" uuid NOT NULL,
	"type" "meter_type" NOT NULL,
	"previous_reading" numeric(12, 2) NOT NULL,
	"current_reading" numeric(12, 2),
	"photo_url" text,
	"reading_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meter_readings_current_gte_previous" CHECK ("meter_readings"."current_reading" is null or "meter_readings"."current_reading" >= "meter_readings"."previous_reading")
);
--> statement-breakpoint
CREATE TABLE "motels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manager_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"electricity_price" numeric(14, 0) NOT NULL,
	"water_price" numeric(14, 0) NOT NULL,
	"other_fees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bank_account" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"motel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"id_number" text,
	"id_card_front_url" text,
	"id_card_back_url" text,
	"room_id" uuid,
	"zalo_oa_id" text,
	"is_oa_follower" boolean DEFAULT false NOT NULL,
	"status" "renter_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "renters_phone_normalised" CHECK ("renters"."phone" ~ '^84[0-9]{9}$')
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"motel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"base_price" numeric(14, 0) DEFAULT '0' NOT NULL,
	"floor" integer,
	"status" "room_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zalo_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"renter_id" uuid NOT NULL,
	"motel_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"template_id" text,
	"payload" jsonb NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_motel_id_motels_id_fk" FOREIGN KEY ("motel_id") REFERENCES "public"."motels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_motel_id_motels_id_fk" FOREIGN KEY ("motel_id") REFERENCES "public"."motels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_renter_id_renters_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."renters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_motel_id_motels_id_fk" FOREIGN KEY ("motel_id") REFERENCES "public"."motels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_renter_id_renters_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."renters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_motel_id_motels_id_fk" FOREIGN KEY ("motel_id") REFERENCES "public"."motels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_renter_id_renters_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."renters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_motel_id_motels_id_fk" FOREIGN KEY ("motel_id") REFERENCES "public"."motels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_renter_id_renters_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."renters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motels" ADD CONSTRAINT "motels_manager_id_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renters" ADD CONSTRAINT "renters_motel_id_motels_id_fk" FOREIGN KEY ("motel_id") REFERENCES "public"."motels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renters" ADD CONSTRAINT "renters_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_motel_id_motels_id_fk" FOREIGN KEY ("motel_id") REFERENCES "public"."motels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zalo_notifications" ADD CONSTRAINT "zalo_notifications_renter_id_renters_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."renters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zalo_notifications" ADD CONSTRAINT "zalo_notifications_motel_id_motels_id_fk" FOREIGN KEY ("motel_id") REFERENCES "public"."motels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_periods_motel_id_idx" ON "billing_periods" USING btree ("motel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_periods_motel_month_year_uq" ON "billing_periods" USING btree ("motel_id","month","year");--> statement-breakpoint
CREATE INDEX "contract_templates_motel_id_idx" ON "contract_templates" USING btree ("motel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_templates_default_uq" ON "contract_templates" USING btree ("motel_id") WHERE "contract_templates"."is_default";--> statement-breakpoint
CREATE INDEX "contracts_renter_id_idx" ON "contracts" USING btree ("renter_id");--> statement-breakpoint
CREATE INDEX "contracts_room_id_idx" ON "contracts" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "contracts_motel_id_idx" ON "contracts" USING btree ("motel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_room_active_uq" ON "contracts" USING btree ("room_id") WHERE "contracts"."status" = 'active';--> statement-breakpoint
CREATE INDEX "help_tickets_renter_id_idx" ON "help_tickets" USING btree ("renter_id");--> statement-breakpoint
CREATE INDEX "help_tickets_motel_id_idx" ON "help_tickets" USING btree ("motel_id");--> statement-breakpoint
CREATE INDEX "invoices_billing_period_id_idx" ON "invoices" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "invoices_renter_id_idx" ON "invoices" USING btree ("renter_id");--> statement-breakpoint
CREATE INDEX "invoices_motel_id_idx" ON "invoices" USING btree ("motel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_period_room_uq" ON "invoices" USING btree ("billing_period_id","room_id");--> statement-breakpoint
CREATE INDEX "magic_links_renter_id_idx" ON "magic_links" USING btree ("renter_id");--> statement-breakpoint
CREATE INDEX "magic_links_expires_at_idx" ON "magic_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "meter_readings_room_id_idx" ON "meter_readings" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "meter_readings_billing_period_id_idx" ON "meter_readings" USING btree ("billing_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meter_readings_period_room_type_uq" ON "meter_readings" USING btree ("billing_period_id","room_id","type");--> statement-breakpoint
CREATE INDEX "motels_manager_id_idx" ON "motels" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "renters_motel_id_idx" ON "renters" USING btree ("motel_id");--> statement-breakpoint
CREATE INDEX "renters_room_id_idx" ON "renters" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "renters_motel_id_phone_uq" ON "renters" USING btree ("motel_id","phone");--> statement-breakpoint
CREATE INDEX "rooms_motel_id_idx" ON "rooms" USING btree ("motel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_motel_id_name_uq" ON "rooms" USING btree ("motel_id","name");--> statement-breakpoint
CREATE INDEX "zalo_notifications_renter_id_idx" ON "zalo_notifications" USING btree ("renter_id");--> statement-breakpoint
CREATE INDEX "zalo_notifications_motel_id_idx" ON "zalo_notifications" USING btree ("motel_id");