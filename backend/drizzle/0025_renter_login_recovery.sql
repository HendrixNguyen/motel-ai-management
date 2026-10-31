CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
ALTER TABLE motels ADD COLUMN public_access_code text;
UPDATE motels SET public_access_code = replace(encode(gen_random_bytes(24), 'base64'), '/', '_') WHERE public_access_code IS NULL;
ALTER TABLE motels ALTER COLUMN public_access_code SET NOT NULL;
ALTER TABLE motels ALTER COLUMN public_access_code SET DEFAULT replace(encode(gen_random_bytes(24), 'base64'), '/', '_');
CREATE UNIQUE INDEX motels_public_access_code_uq ON motels(public_access_code);
ALTER TABLE motels ADD CONSTRAINT motels_public_access_code_nonempty CHECK (length(trim(public_access_code)) >= 20);
CREATE TABLE renter_login_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motel_id uuid NOT NULL REFERENCES motels(id) ON DELETE CASCADE,
  renter_id uuid NOT NULL REFERENCES renters(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz,
  handled_by_manager_id uuid REFERENCES managers(id),
  CONSTRAINT renter_login_requests_status_check CHECK (status IN ('pending', 'handled', 'dismissed')),
  CONSTRAINT renter_login_requests_handled_fields_check CHECK ((status = 'pending' AND handled_at IS NULL AND handled_by_manager_id IS NULL) OR (status <> 'pending' AND handled_at IS NOT NULL AND handled_by_manager_id IS NOT NULL))
);
CREATE INDEX renter_login_requests_motel_status_idx ON renter_login_requests(motel_id, status, requested_at);
CREATE UNIQUE INDEX renter_login_requests_pending_owner_uq ON renter_login_requests(motel_id, renter_id) WHERE status = 'pending';
DELETE FROM magic_links;
ALTER TABLE magic_links DROP COLUMN token;
ALTER TABLE magic_links ADD COLUMN token_hash text NOT NULL;
ALTER TABLE magic_links ADD CONSTRAINT magic_links_token_hash_uq UNIQUE (token_hash);
ALTER TABLE magic_links ADD CONSTRAINT magic_links_token_hash_format CHECK (token_hash ~ '^[a-f0-9]{64}$');
