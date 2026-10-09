CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer', 'cash');
ALTER TABLE "invoices" ADD COLUMN "payment_method" "payment_method";
ALTER TABLE "invoices" ADD COLUMN "payment_proof_id" uuid;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_proof_id_fk" FOREIGN KEY ("payment_proof_id") REFERENCES "public"."payment_proofs"("id") ON DELETE SET NULL;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_method_proof_check" CHECK (("payment_method" = 'bank_transfer' AND "payment_proof_id" IS NOT NULL) OR ("payment_method" = 'cash' AND "payment_proof_id" IS NULL) OR ("payment_method" IS NULL AND "payment_proof_id" IS NULL));
