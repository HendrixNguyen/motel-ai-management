CREATE TABLE "manager_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manager_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"session_version" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manager_sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "manager_sessions_token_hash_format" CHECK ("manager_sessions"."token_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "manager_sessions_version_nonnegative" CHECK ("manager_sessions"."session_version" >= 0)
);
--> statement-breakpoint
ALTER TABLE "manager_sessions" ADD CONSTRAINT "manager_sessions_manager_id_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manager_sessions_manager_id_idx" ON "manager_sessions" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "manager_sessions_expires_at_idx" ON "manager_sessions" USING btree ("expires_at");