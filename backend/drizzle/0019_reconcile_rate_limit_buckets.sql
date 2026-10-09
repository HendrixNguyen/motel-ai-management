DO $$
DECLARE
  has_bucket_key boolean;
  has_window_start boolean;
  has_request_count boolean;
  has_key boolean;
  has_window_started_at boolean;
  has_count boolean;
BEGIN
  IF to_regclass('public.rate_limit_buckets') IS NULL THEN
    CREATE TABLE public.rate_limit_buckets (
      bucket_key text NOT NULL,
      window_start timestamptz NOT NULL,
      request_count integer NOT NULL DEFAULT 0,
      PRIMARY KEY (bucket_key, window_start)
    );
    CREATE INDEX IF NOT EXISTS rate_limit_buckets_window_idx ON public.rate_limit_buckets (window_start);
    RETURN;
  END IF;

  SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rate_limit_buckets' AND column_name = 'bucket_key'),
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rate_limit_buckets' AND column_name = 'window_start'),
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rate_limit_buckets' AND column_name = 'request_count'),
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rate_limit_buckets' AND column_name = 'key'),
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rate_limit_buckets' AND column_name = 'window_started_at'),
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rate_limit_buckets' AND column_name = 'count')
  INTO has_bucket_key, has_window_start, has_request_count, has_key, has_window_started_at, has_count;

  IF has_bucket_key AND has_window_start AND has_request_count THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.rate_limit_buckets'::regclass
        AND contype = 'p'
        AND pg_get_constraintdef(oid) = 'PRIMARY KEY (bucket_key, window_start)'
    ) THEN
      ALTER TABLE public.rate_limit_buckets DROP CONSTRAINT IF EXISTS rate_limit_buckets_pkey;
      ALTER TABLE public.rate_limit_buckets ADD CONSTRAINT rate_limit_buckets_pkey PRIMARY KEY (bucket_key, window_start);
    END IF;
    CREATE INDEX IF NOT EXISTS rate_limit_buckets_window_idx ON public.rate_limit_buckets (window_start);
    RETURN;
  END IF;

  IF has_key AND has_window_started_at AND has_count THEN
    ALTER TABLE public.rate_limit_buckets RENAME COLUMN key TO bucket_key;
    ALTER TABLE public.rate_limit_buckets RENAME COLUMN window_started_at TO window_start;
    ALTER TABLE public.rate_limit_buckets RENAME COLUMN count TO request_count;
    ALTER TABLE public.rate_limit_buckets ALTER COLUMN request_count SET DEFAULT 0;
    ALTER TABLE public.rate_limit_buckets DROP CONSTRAINT IF EXISTS rate_limit_buckets_count_check;
    ALTER TABLE public.rate_limit_buckets DROP CONSTRAINT IF EXISTS rate_limit_buckets_pkey;
    ALTER TABLE public.rate_limit_buckets ADD CONSTRAINT rate_limit_buckets_pkey PRIMARY KEY (bucket_key, window_start);
    ALTER TABLE public.rate_limit_buckets ALTER COLUMN request_count SET NOT NULL;
    CREATE INDEX IF NOT EXISTS rate_limit_buckets_window_idx ON public.rate_limit_buckets (window_start);
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unrecognized rate_limit_buckets schema; refusing destructive reconciliation';
END
$$;

ALTER TABLE public.rate_limit_buckets ALTER COLUMN request_count SET NOT NULL;
