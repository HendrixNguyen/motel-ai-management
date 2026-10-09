# Task 7 report

## Scope

Migrated manager overview, motels, rooms, renters, and billing empty/data surfaces to Core UI v2 `Card`, `StatCard`, and `EmptyState` compositions. Existing API reads, motel URL scope, room filters, status labels, and formatting remain unchanged.

Added `frontend/src/components/ui/__tests__/migration-states.test.tsx` covering shared empty, loading, warning/dark-token surfaces.

## Verification

- `node_modules/.bin/vitest run src/lib/__tests__/motels-page.test.ts src/components/ui/__tests__/migration-states.test.tsx` — 7 passed.
- `node_modules/.bin/tsc --noEmit` — passed.
- Targeted ESLint on changed files — passed.
- `node_modules/.bin/next build` — TypeScript phase completed; command output was truncated by runner before final status.
- Full Vitest: 413 passed, 4 pre-existing failures in theme/sidebar contracts; no migration test failure.
- Mobile Playwright not run: Bun unavailable in environment and browser OS dependencies are not installed.

## Notes

Review fixes: empty motel CTA now uses working `MotelEditor empty`; `EmptyState` action is optional; motel and room cards use shared `Card` with semantic `article`; dark-mode migration test asserts CSS semantic tokens.

Payment backend/schema/module and Task 6 report changes were removed from Task 7 scope through dedicated revert commits `604526d`, `924d9ce`, `cd6b569`, and `5f23d90`. Existing unrelated worktree changes remain untouched. Full portal/capture/contracts migration remains outside this incremental pass because existing screens depend on their current client workflows and fixture contracts.

Post-fix verification: 13 targeted tests passed; frontend typecheck and targeted ESLint passed.

Final review fixes: notification enqueue executor uses explicit `NotificationExecutor` type with no `any`, preserving DB behavior. Migration coverage renders `EmptyState` both without action (no button) and with action (button present). Backend TypeScript check passed through installed `tsc`; Bun command unavailable in environment.

Final ancestry cleanup: payment route and service introduced after Task 7 were removed with revert commits `a924af7` and `76b5439`; payment schema/types remain exported truthfully through `backend/src/db/schemas.ts`. Pre-existing `payment-proof-schema.test.ts` was restored from parent history. Payment route/service are out of Task 7 scope; no payment redesign was attempted. Backend typecheck is historical/unverified in this environment because Bun is unavailable; no current Bun verification claim is made. Task 7 frontend diff contains no payment module additions.

## Rate-limit migration reconciliation

- Added `backend/drizzle/0019_reconcile_rate_limit_buckets.sql` and journal idx17; kept historical migration SQL and prior journal entries unchanged.
- Local `motel_test` ledger records 0016; its table had `key/window_started_at/count`. The table was only inspected; schema remained unchanged by verification. Earlier `bun run db:migrate` ignored environment override via config and connected to local `motel`; read-only inspection found no rate-limit table there.
- Used dedicated disposable local DBs with explicit `DATABASE_URL` and isolated migrator runner. Empty install succeeded: 18 migration ledger rows; table has `(bucket_key, window_start)` PK, `request_count integer NOT NULL DEFAULT 0`, and window index.
- Upgrade fixture through 0016 with legacy schema/data migrated successfully; representative key/count 7 survived under renamed columns. Separate composite-schema fixture also migrated successfully and retained count 4.
- Re-running migrations on scratch DBs succeeded without duplicate-object failures.
- No project migration regression test added: repository has no migration test harness; verification was performed against actual PostgreSQL scratch DBs.
- `git diff --check` passed. No QA/prod access, deploy, or push.
