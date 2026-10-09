CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer', 'cash');
ALTER TABLE "invoices" ADD COLUMN "payment_method" "payment_method";
ALTER TABLE "invoices" ADD COLUMN "payment_proof_id" uuid;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_proof_id_fk" FOREIGN KEY ("payment_proof_id") REFERENCES "public"."payment_proofs"("id") ON DELETE SET NULL;
