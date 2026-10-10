ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_id_renter_motel_uq" UNIQUE ("id", "renter_id", "motel_id");
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_proof_ownership_fk" FOREIGN KEY ("payment_proof_id", "renter_id", "motel_id") REFERENCES "public"."payment_proofs"("id", "renter_id", "motel_id") ON DELETE no action ON UPDATE no action;
