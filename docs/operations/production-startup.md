# Production startup and seed order

The supported Compose startup gates backend runners on PostgreSQL health and a separate one-shot `migration-job` (`backend` Dockerfile target `migration-job`, command `bun run db:migrate`). Migration failure blocks backend startup; never run migrations concurrently from replicas. Backend startup has no seed side effects and does not require `SUPERADMIN_PASSWORD`.

Production requires HTTPS `FRONTEND_URL`, production database URL, R2 credentials and distinct `MANAGER_JWT_SECRET`, `ADMIN_JWT_SECRET` and `RENTER_SESSION_SECRET`; Zalo values are required only when Zalo OA integration is enabled. `TEST_DATABASE_URL` is optional in production and must point to a separate disposable database if supplied. Compose passes database URLs as complete values, keeping PostgreSQL private with no host port mapping.

## System account and contract catalog

After migrations complete, run the explicit one-shot command `bun run db:seed-system` from the backend release. The command does not run migrations and is never called by backend startup. It creates or verifies only `superadmin@motel.huyndg.io.vn` and inserts missing shared contract-template catalog versions; it does not create demo or business data. Before running, perform a read-only preflight for the canonical email and inspect any existing identity conflict (role, enabled/disabled state) without reading or exposing password hashes. Stop on a conflict; resolve it explicitly rather than changing an existing account automatically.

Provide `SUPERADMIN_PASSWORD` through protected Dokploy runtime secret injection for this one-shot operation. Never pass it as a CLI argument or write it to logs, source, deployment descriptions, or reports. Never make it a persistent backend-startup requirement. Verify the safe command result, login, and catalog after execution. QA and Prod use independent databases and may use different secret values.

## QA-only demo seed

`backend/src/db/seed.ts` is destructive demo-data seeding. It is permitted only for QA with both `APP_ENV=qa` and explicit `SEED_DATABASE=true`; it must never run against Prod. Do not include a demo-seed invocation in a production deployment procedure. The system seed is separate and does not invoke the demo seed.

## Roles and manager setup

Superadmin sessions administer Manager accounts and read the shared contract catalog only; tenant business endpoints reject Superadmin role. Manager sessions remain tenant-scoped with full access to their own motel business features. Superadmin manager creation and password reset accept direct passwords and store only Argon2id hashes. Reset/disable revokes sessions by incrementing `sessionVersion`; disabled manager accounts do not alter renter portal access or tenant data. Public `/api/auth/register` remains available for normal manager onboarding and can only create role `manager`.

## Future Prod ship checklist — separate approval required

Prod deployment and seeding are outside QA work. Perform these steps only after separate explicit approval for Prod; never run them as part of QA rollout:

1. Confirm approved release and change window; verify Dokploy Prod application, database, and protected `SUPERADMIN_PASSWORD` secret by key name only. Never print secret values.
2. Perform read-only identity preflight for `superadmin@motel.huyndg.io.vn`, including role and enabled state, and check schema/migration state through an authorized read-only path. Stop on identity conflict or unknown schema state; do not infer readiness from deployment status.
3. Complete the established one-shot migration procedure and verify success before proceeding. Do not run migrations concurrently from backend replicas.
4. Run `bun run db:seed-system` once with protected Dokploy `SUPERADMIN_PASSWORD` injection. The seed does not migrate. Never pass password as CLI argument or log it.
5. Verify one enabled canonical Superadmin, expected catalog rows, successful login and backend health; confirm no demo/business rows were created by system seed.
6. Do not run `backend/src/db/seed.ts` in Prod. QA-only demo seed requires `APP_ENV=qa` and `SEED_DATABASE=true`.
7. Record outcome without credentials. Keep public routing/launch steps subject to their own approval.
