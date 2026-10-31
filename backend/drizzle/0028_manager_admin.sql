CREATE TYPE "public"."manager_role" AS ENUM('manager', 'superadmin');--> statement-breakpoint
CREATE TABLE "manager_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contract_template_catalog" DROP CONSTRAINT "contract_template_catalog_key_nonempty";--> statement-breakpoint
ALTER TABLE "managers" ADD COLUMN "role" "manager_role" DEFAULT 'manager' NOT NULL;--> statement-breakpoint
ALTER TABLE "managers" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "managers" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "manager_audit_events" ADD CONSTRAINT "manager_audit_events_actor_id_managers_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_audit_events" ADD CONSTRAINT "manager_audit_events_target_id_managers_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "managers_single_superadmin_uq" ON "managers" USING btree ((true)) WHERE "managers"."role" = 'superadmin';--> statement-breakpoint
ALTER TABLE "managers" ADD CONSTRAINT "managers_session_version_nonnegative" CHECK ("managers"."session_version" >= 0);--> statement-breakpoint
ALTER TABLE "contract_template_catalog" ADD CONSTRAINT "contract_template_catalog_key_format" CHECK ("contract_template_catalog"."key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "contract_template_catalog" ADD CONSTRAINT "contract_template_catalog_name_nonempty" CHECK (length(trim("contract_template_catalog"."name")) > 0);--> statement-breakpoint
ALTER TABLE "contract_template_catalog" ADD CONSTRAINT "contract_template_catalog_clauses_array" CHECK (jsonb_typeof("contract_template_catalog"."clauses") = 'array' AND NOT jsonb_path_exists("contract_template_catalog"."clauses", '$[*] ? (@.title.type() != "string" || @.content.type() != "string" || @.title == "" || @.content == "")'));