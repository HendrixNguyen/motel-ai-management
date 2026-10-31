# System Seed for Superadmin and Contract Templates

**Status:** Draft for review  
**Date:** 2026-10-30  
**Scope:** Separate system seed for one initial Superadmin and shared contract templates; keep destructive demo data isolated to QA. No product-wide multi-tenant Superadmin redesign.

## Goal

Ensure production contains no demo motel/business data, while QA and production receive one known system Superadmin identity and the shared contract-template catalog through an explicit, repeatable operation. Use the same Superadmin email on QA and production, with environment-specific passwords held as Dokploy secrets.

## Decisions

- Canonical system account email: `superadmin@motel.huyndg.io.vn`; display name remains `Motel Platform Admin`; role is `superadmin`.
- A dedicated system seed file/command owns only this account and the shared contract-template catalog. It never creates or deletes manager, motel, room, renter, invoice, meter, ticket, notification, or other demo/business rows.
- `SUPERADMIN_PASSWORD` comes from protected Dokploy runtime environment during the one-shot command. Source and image contain no plaintext credential; store only an Argon2id hash.
- Execute explicitly with `bun run db:seed-system` after schema migrations, not automatically on every server startup. Backend startup must not depend on `SUPERADMIN_PASSWORD` and must not create seed data.
- Seed is idempotent. If canonical email is absent, create it. If present with exact canonical name, enabled Superadmin role, and supplied password verifies, do nothing to the account. If present with another role/name, disabled, or mismatched password, fail with a reason-specific error and make no changes. Never promote, enable, rename, delete, or reset an existing account automatically.
- Contract templates use existing insert-on-conflict-no-op versioned catalog semantics. Existing versions are never overwritten.
- Remove `PRODUCTION_SUPERADMIN_CONFIRM`; current `src/index.ts` supplies it as a hard-coded value, so it does not provide an independent confirmation gate.
- Keep `backend/src/db/seed.ts` as destructive demo-data seed, runnable only with `APP_ENV=qa` and `SEED_DATABASE=true`; it must also reject `NODE_ENV=production` unconditionally. Do not use it for system account/templates.
- Public and admin Manager creation must reject the canonical Superadmin email. No database uniqueness constraint limiting Superadmin role count is added in this change; future shared-DB customer provisioning needs separate tenant-scoped design.
- QA and production share canonical email but have independent databases and can use different secret values.

## Current QA Finding and Recovery

Read-only QA inspection on 2026-10-30 found `manage@example.com` with role `manager`, active; QA had five manager rows and no Superadmin rows. That account remains an ordinary Manager and must not be promoted or deleted. New canonical email avoids colliding with it, but before running the new seed, verify `superadmin@motel.huyndg.io.vn` is absent on QA and production. If already present, stop and inspect email/role/disabled state before any data change.

The QA `SUPERADMIN_PASSWORD` Dokploy secret was added, but current backend source does not consume it at startup unless `AUTO_MIGRATE=true`; even then an existing email collision would fail bootstrap. The new one-shot command consumes the secret directly without adding a startup dependency. Do not reuse the previously exposed QA DB password; rotate that database credential separately.

## Implementation Changes

1. Add `backend/src/db/seed-system.ts`, implementing one transaction that inserts/verifies the canonical Superadmin and seeds contract templates. Require `NODE_ENV=production` or `staging` for deployed environments (tests inject env); validate secret length 12–256; use advisory transaction lock; emit safe summary only.
2. Add `db:seed-system` script in `backend/package.json`; remove/retire `db:bootstrap-superadmin` command and old bootstrap module after migration of behavior.
3. Remove Superadmin bootstrap and contract catalog writes from `backend/src/index.ts`; leave migration behavior unchanged. Startup should only migrate if existing `AUTO_MIGRATE=true` policy says so, then serve; it must not create system/business seed data.
4. Update canonical identity constant and every reserved-email check in public registration and Superadmin Manager creation.
5. Keep demo seeding separately gated: production remains forbidden; require an explicit QA-only opt-in/environment guard so a wrong target cannot run it. QA demo seed may still reset only QA data by explicit operator action.
6. Remove `PRODUCTION_SUPERADMIN_CONFIRM` references from backend env examples, tests, package scripts, runbooks, specs and plans; document one-shot order: migrations, system seed, verify login/health.
7. Update tests for create, matching rerun, wrong-role/disabled/password conflict with no writes, transaction rollback, catalog idempotency, no business rows, canonical-email reservation, demo seed production guard, and secret non-disclosure.

## Failure and Safety Behavior

- Missing/invalid `SUPERADMIN_PASSWORD`, incomplete schema, database error, or identity conflict returns nonzero before committing partial account/catalog writes.
- Error output distinguishes conflict reason (role, disabled state, password mismatch) but never includes secret, hash, or SQL/database URL.
- The command never changes an existing account. An operator must explicitly resolve a conflict after read-only inspection; production identity conflict resolution requires separate explicit authorization before any mutation.
- Never run demo seed on production. Never use `SUPERADMIN_PASSWORD` as a persistent backend startup requirement; it is supplied only to the one-shot operation and can be removed from runtime env after successful seed, subject to Dokploy's env replacement workflow.

## Rollout and Verification

1. Implement and test locally against the disposable test DB; do not reset QA/Prod.
2. Deploy code to QA without changing Prod. Confirm QA backend health and that startup does not bootstrap or crash-loop.
3. Read-only check whether canonical email exists in QA. If absent, run migration if required, then one-shot system seed with the QA Dokploy secret; inspect outcome and verify exactly one enabled account at the canonical email, matching login, and catalog rows.
4. Confirm `manage@example.com` remains role `manager`; do not modify or delete it.
5. Remove QA `SUPERADMIN_PASSWORD` from persistent runtime env only after seed and login verified, preserving all other env values.
6. Before Prod deploy, run read-only preflight for canonical email and existing Superadmin rows. Resolve any collision explicitly; never overwrite. Deploy code, migrate using the established one-shot migration procedure, run system seed once with Prod-specific secret, verify login/catalog/health.
7. Do not run a Prod deployment or mutate Prod as part of the QA work.

## Explicitly Out of Scope

- Shared-database customer tenancy and tenant-scoped Superadmin uniqueness.
- Landing-page customer signup/account creation flow.
- Automatic password recovery/reset workflow for Superadmin.
- Destructive demo-data modifications or production launch/domain changes.
