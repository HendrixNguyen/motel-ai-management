CREATE TABLE "motel_setup_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manager_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"motel_id" uuid,
	"template_id" uuid,
	"mode" text NOT NULL,
	"room_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "motel_setup_requests_mode_check" CHECK ("motel_setup_requests"."mode" IN ('full', 'quick')),
	CONSTRAINT "motel_setup_requests_room_count_check" CHECK (("motel_setup_requests"."mode" = 'full' AND "motel_setup_requests"."room_count" >= 1 AND "motel_setup_requests"."room_count" <= 100) OR ("motel_setup_requests"."mode" = 'quick' AND "motel_setup_requests"."room_count" = 0))
);
--> statement-breakpoint
ALTER TABLE "motel_setup_requests" ADD CONSTRAINT "motel_setup_requests_manager_id_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motel_setup_requests" ADD CONSTRAINT "motel_setup_requests_motel_id_motels_id_fk" FOREIGN KEY ("motel_id") REFERENCES "public"."motels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motel_setup_requests" ADD CONSTRAINT "motel_setup_requests_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "motel_setup_requests_manager_request_uq" ON "motel_setup_requests" USING btree ("manager_id","request_id");