CREATE TYPE "public"."payment_proof_status" AS ENUM('pending', 'approved', 'rejected');

CREATE TABLE "payment_proofs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "renter_id" uuid NOT NULL,
  "motel_id" uuid NOT NULL,
  "object_key" text NOT NULL,
  "content_type" text NOT NULL,
  "size" integer NOT NULL,
  "checksum" text NOT NULL,
  "status" "payment_proof_status" DEFAULT 'pending' NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  "reviewed_by_manager_id" uuid,
  "rejection_reason" text,
  CONSTRAINT "payment_proofs_content_type_check" CHECK ("content_type" in ('image/jpeg', 'image/png')),
  CONSTRAINT "payment_proofs_size_check" CHECK ("size" between 1 and 10485760),
  CONSTRAINT "payment_proofs_checksum_check" CHECK (length(trim("checksum")) > 0),
  CONSTRAINT "payment_proofs_review_state_check" CHECK (("status" = 'pending' and "reviewed_at" is null and "reviewed_by_manager_id" is null and "rejection_reason" is null) or ("status" = 'approved' and "reviewed_at" is not null and "reviewed_by_manager_id" is not null and "rejection_reason" is null) or ("status" = 'rejected' and "reviewed_at" is not null and "reviewed_by_manager_id" is not null and length(trim("rejection_reason")) between 1 and 500))
);

ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_invoice_ownership_fk" FOREIGN KEY ("invoice_id", "renter_id", "motel_id") REFERENCES "public"."invoices"("id", "renter_id", "motel_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_renter_id_renters_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."renters"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_motel_id_motels_id_fk" FOREIGN KEY ("motel_id") REFERENCES "public"."motels"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_reviewed_by_manager_id_managers_id_fk" FOREIGN KEY ("reviewed_by_manager_id") REFERENCES "public"."managers"("id") ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX "invoices_id_renter_motel_uq" ON "invoices" USING btree ("id", "renter_id", "motel_id");

CREATE INDEX "payment_proofs_invoice_id_idx" ON "payment_proofs" USING btree ("invoice_id");
CREATE INDEX "payment_proofs_renter_id_idx" ON "payment_proofs" USING btree ("renter_id");
CREATE INDEX "payment_proofs_motel_id_idx" ON "payment_proofs" USING btree ("motel_id");
CREATE UNIQUE INDEX "payment_proofs_object_key_uq" ON "payment_proofs" USING btree ("object_key");
CREATE UNIQUE INDEX "payment_proofs_current_invoice_uq" ON "payment_proofs" USING btree ("invoice_id") WHERE "status" <> 'rejected';
