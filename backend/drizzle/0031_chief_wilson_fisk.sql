CREATE TABLE "monthly_utility_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"motel_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"electricity_amount" numeric(14, 0),
	"water_amount" numeric(14, 0),
	"electricity_notes" text,
	"water_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_utility_costs_month_range" CHECK ("monthly_utility_costs"."month" between 1 and 12),
	CONSTRAINT "monthly_utility_costs_year_range" CHECK ("monthly_utility_costs"."year" between 1 and 9999),
	CONSTRAINT "monthly_utility_costs_electricity_nonnegative" CHECK ("monthly_utility_costs"."electricity_amount" is null or "monthly_utility_costs"."electricity_amount" >= 0),
	CONSTRAINT "monthly_utility_costs_water_nonnegative" CHECK ("monthly_utility_costs"."water_amount" is null or "monthly_utility_costs"."water_amount" >= 0),
	CONSTRAINT "monthly_utility_costs_electricity_notes_length" CHECK ("monthly_utility_costs"."electricity_notes" is null or char_length("monthly_utility_costs"."electricity_notes") <= 2000),
	CONSTRAINT "monthly_utility_costs_water_notes_length" CHECK ("monthly_utility_costs"."water_notes" is null or char_length("monthly_utility_costs"."water_notes") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "monthly_utility_costs" ADD CONSTRAINT "monthly_utility_costs_motel_id_motels_id_fk" FOREIGN KEY ("motel_id") REFERENCES "public"."motels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_utility_costs_motel_year_month_uq" ON "monthly_utility_costs" USING btree ("motel_id","year","month");