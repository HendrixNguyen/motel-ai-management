ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_method" text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_proof_id" uuid;
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_payment_proof_id_uq" ON "invoices" ("payment_proof_id") WHERE "payment_proof_id" IS NOT NULL;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_method_check" CHECK ("payment_method" IS NULL OR "payment_method" IN ('bank_transfer', 'cash'));
