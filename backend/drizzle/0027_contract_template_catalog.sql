CREATE TABLE "contract_template_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"clauses" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_template_catalog_key_format" CHECK ("contract_template_catalog"."key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "contract_template_catalog_version_positive" CHECK ("contract_template_catalog"."version" > 0),
	CONSTRAINT "contract_template_catalog_name_nonempty" CHECK (length(trim("contract_template_catalog"."name")) > 0),
	CONSTRAINT "contract_template_catalog_clauses_array" CHECK (jsonb_typeof("contract_template_catalog"."clauses") = 'array' AND NOT jsonb_path_exists("contract_template_catalog"."clauses", '$[*] ? (@.title.type() != "string" || @.content.type() != "string" || @.title == "" || @.content == "")'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "contract_template_catalog_key_version_uq" ON "contract_template_catalog" USING btree ("key","version");
