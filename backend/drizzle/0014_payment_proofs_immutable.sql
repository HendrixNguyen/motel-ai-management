CREATE OR REPLACE FUNCTION reject_reviewed_payment_proof_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('approved', 'rejected') AND (
    NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR
    NEW.renter_id IS DISTINCT FROM OLD.renter_id OR
    NEW.motel_id IS DISTINCT FROM OLD.motel_id OR
    NEW.object_key IS DISTINCT FROM OLD.object_key OR
    NEW.content_type IS DISTINCT FROM OLD.content_type OR
    NEW.size IS DISTINCT FROM OLD.size OR
    NEW.checksum IS DISTINCT FROM OLD.checksum OR
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
    NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR
    NEW.reviewed_by_manager_id IS DISTINCT FROM OLD.reviewed_by_manager_id OR
    NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
  ) THEN
    RAISE EXCEPTION 'reviewed payment proofs are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_proofs_reviewed_immutable
BEFORE UPDATE ON payment_proofs
FOR EACH ROW
EXECUTE FUNCTION reject_reviewed_payment_proof_update();
