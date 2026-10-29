CREATE TYPE manager_role AS ENUM ('manager', 'superadmin');
ALTER TABLE managers ADD COLUMN role manager_role NOT NULL DEFAULT 'manager';
ALTER TABLE managers ADD COLUMN disabled_at timestamptz;
ALTER TABLE managers ADD COLUMN session_version integer NOT NULL DEFAULT 0;
ALTER TABLE managers ADD CONSTRAINT managers_session_version_nonnegative CHECK (session_version >= 0);
CREATE UNIQUE INDEX managers_single_superadmin_uq ON managers ((true)) WHERE role = 'superadmin';
CREATE TABLE manager_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES managers(id),
  target_id uuid NOT NULL REFERENCES managers(id),
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
