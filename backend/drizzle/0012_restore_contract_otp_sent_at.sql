DO $$
DECLARE
  column_type text;
BEGIN
  SELECT data_type INTO column_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'otp_sent_at';

  IF column_type IS NULL THEN
    ALTER TABLE "contracts" ADD COLUMN "otp_sent_at" timestamp with time zone;
  ELSIF column_type <> 'timestamp with time zone' THEN
    RAISE EXCEPTION 'contracts.otp_sent_at has unexpected type: %', column_type;
  END IF;
END $$;
