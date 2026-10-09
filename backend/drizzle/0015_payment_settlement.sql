CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer', 'cash');
ALTER TABLE "invoices" ADD COLUMN "payment_method" "payment_method";
ALTER TABLE "invoices" ADD COLUMN "payment_proof_id" uuid;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_proof_id_fk" FOREIGN KEY ("payment_proof_id") REFERENCES "public"."payment_proofs"("id") ON DELETE SET NULL;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_method_proof_check" CHECK (("payment_method" = 'bank_transfer' AND "payment_proof_id" IS NOT NULL) OR ("payment_method" = 'cash' AND "payment_proof_id" IS NULL) OR ("payment_method" IS NULL AND "payment_proof_id" IS NULL));
CREATE FUNCTION enforce_payment_proof_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_method = 'bank_transfer' AND NEW.payment_proof_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM payment_proofs WHERE id = NEW.payment_proof_id AND invoice_id = NEW.id AND motel_id = NEW.motel_id AND status = 'approved') THEN
      RAISE EXCEPTION 'payment proof must belong to approved invoice proof';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER invoices_payment_proof_settlement_fk AFTER INSERT OR UPDATE ON invoices DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_payment_proof_settlement();
