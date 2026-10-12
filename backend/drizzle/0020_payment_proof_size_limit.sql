ALTER TABLE "payment_proofs" DROP CONSTRAINT "payment_proofs_size_check";
--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_size_check" CHECK ("size" between 1 and 5000000);
