ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_method" text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_proof_id" uuid;
