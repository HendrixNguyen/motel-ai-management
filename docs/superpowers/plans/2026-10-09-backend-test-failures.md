# Backend Test Failures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diagnose and fix remaining backend integration-test and migration failures on `production-payment`, preserving the existing UI work and local secrets.

**Architecture:** First capture reproducible failure evidence and identify whether each mismatch belongs to implementation, fixture, assertion, or migration history. Then make narrowly scoped test-first fixes across billing, renter routes, constraints, and migrations. Verify migration behavior on isolated disposable PostgreSQL databases for both clean install and upgrade from the last known deployed journal; run DB-resetting Bun tests sequentially.

**Tech Stack:** Bun test, TypeScript, Elysia, Drizzle ORM, PostgreSQL, Drizzle SQL migrations, GitHub CLI.

**Spec:** `docs/testing-strategy.md`, especially database constraints, real PostgreSQL, test failure quality, billing workflows, and migration verification.

## Global Constraints

- Integration tests use real PostgreSQL and `resetDb()` destroys schemas; only use `TEST_DATABASE_URL` for tests.
- Never point `TEST_DATABASE_URL` at data that must be retained.
- Run one backend DB test file at a time; concurrent files reset the same schema.
- Test SQL constraints by attempting invalid writes and asserting PostgreSQL rejects.
- Tenant denial is 404; do not weaken security assertions to make tests green.
- Do not print, copy, alter, or commit `backend/.env` or any credentials.
- Preserve current frontend/UI changes; this plan must not touch frontend files.
- Do not run migration verification against production or reset QA data. Use disposable local databases; upgrade validation must use a snapshot/fixture without sensitive production data.

## Review Focus

- PostgreSQL `timestamptz` precision exceeds JavaScript `Date` milliseconds; prove stale-write detection at sub-millisecond differences and preserve timestamp round-trip semantics.
- Missing meter row vs stale version must return distinct `NOT_FOUND` and `READING_CONFLICT` codes without partial batch writes.
- Drizzle lazy query builders must execute before assertions; prove constraint tests fail for the intended DB error, not a never-executed thenable.
- Invoice snapshots must match persisted exact values across first generation, draft regeneration, and paid rerun.
- Magic-link URL assertion must derive expected value from the configured renter portal URL without exposing environment secrets.
- Fetch `Request` inputs must be absolute URLs; route assertions must continue to prove renter isolation.
- Migration history must have unique ordered tags and one authoritative rate-limit schema; both clean install and upgrade must reach same intended schema.

---

## Evidence and current state

- PR #12 is **OPEN**, base `qa`, head `production-payment`, merge state `CLEAN`; current `gh pr status` showed no CI checks in the rollup. Recheck immediately before execution/merge decisions because status changes independently.
- HEAD `7d19d4a` and working tree was clean at plan authoring. Existing UI changes are committed on branch and must remain untouched.
- `backend/.env` exists only as ignored local data (`git status --ignored` showed `!! backend/.env`); `backend/.env.example` is tracked. Never read or expose `.env` values.
- `docs/testing-strategy.md` requires PostgreSQL-backed DB tests, sequential reset-based runs, and migration checks without production reset.
- `backend/src/modules/billing/billing.service.ts:133-143` parses `expectedUpdatedAt` to `Date`, compares `.getTime()`, then conditions update on `updatedAt`; PostgreSQL `timestamptz` can retain microseconds while JS Date cannot.
- Same service checks for a row at `billing.service.ts:128-130` before comparing timestamp. Batch failure test `backend/src/test/billing-reading.test.ts:14-22` expects `NOT_FOUND`; stale-writer tests are at lines 60-78.
- `backend/src/test/billing-invoice.test.ts:39-80` contains exact first-generation and regeneration arithmetic assertions. Do not alter expected numbers without tracing fixtures, contract selection, rates, fees, and stored rows.
- `backend/src/test/renter-auth.test.ts:38-45` checks `url === ${env.renterPortalUrl}/r/${token}`; configuration ownership is `backend/src/config.ts` / `backend/src/env.ts`, and generation implementation is `backend/src/shared/magic-link.ts`.
- `backend/src/test/renter-portal.test.ts:103-110` constructs two `Request` objects with relative paths; convert to absolute `http://localhost/...` like neighboring calls.
- `backend/src/test/payment-proof-schema.test.ts` covers actual DB constraints, but fixture `paymentProofs` inserts/assertions contain some builder calls without `.execute()` / `.returning()` (e.g. lines 27 and 57); normalize execution explicitly and ensure failing inserts reject.
- Migration journal `backend/drizzle/meta/_journal.json` records `0015_payment_settlement` at idx 15 and `0016_rate_limit_buckets` at idx 16. Files also include `backend/drizzle/0015_rate_limit_buckets.sql` and `backend/drizzle/0016_rate_limit_buckets.sql`; these both create `rate_limit_buckets` with incompatible columns. `backend/drizzle/0015_payment_settlement.sql` separately shares numeric prefix 0015, so collision is confirmed; correct fix must preserve deployed migration compatibility, not merely rename files.
- Note discrepancy in current repository: user referred to a missing journal entry, but journal currently contains a `0016_rate_limit_buckets` entry. Verify historical branch/deployed journal or migration runner state before changing journal; do not assume this claim is still true.

## File map

- Modify `backend/src/modules/billing/billing.service.ts` only if reproduction proves implementation defect in precision or conflict mapping.
- Modify `backend/src/test/billing-reading.test.ts` for precision, missing-row, conflict-order, rollback tests.
- Inspect/modify `backend/src/test/billing-invoice.test.ts` only after capturing complete failing assertion and database trace.
- Modify `backend/src/test/renter-auth.test.ts` or `backend/src/shared/magic-link.ts` / `backend/src/config.ts` only after separating assertion/config mismatch from generation behavior.
- Modify `backend/src/test/renter-portal.test.ts` for absolute Request URL construction; change route/service only if HTTP evidence shows additional defect.
- Modify `backend/src/test/payment-proof-schema.test.ts` to execute every lazy query and use real DB rejection assertions; modify schema/SQL only if constraint differs from intended invariant.
- Modify migration SQL/journal files under `backend/drizzle/` and `backend/drizzle/meta/` only after upgrade history is established. Keep existing migration records immutable for databases that already applied them; use a forward corrective migration if needed.
- No frontend files, env files, or credentials are in scope.

## Task 1: Capture reproducible failure trace and establish safe DB/migration baseline

**Files:** No code changes. Inspect `backend/src/db/test-db.ts`, `backend/src/db/migrate.ts`, migration files/journal, failure report/logs if present.

- [ ] Record `git status --short --branch`, `git rev-parse HEAD`, PR #12 state/checks (`gh pr view 12 --json state,baseRefName,headRefName,mergeStateStatus,statusCheckRollup,url`). Do not overwrite existing changes.
- [ ] Confirm only safe local test DB is configured without printing secret values. Check variable presence/redact URL (`TEST_DATABASE_URL` only as set/not set); do not `cat` `.env`.
- [ ] Run the failing test files one at a time, capturing full command, timestamp, SHA, failure names and actual-vs-expected output. Start with `cd backend && bun run typecheck`, then `bun test src/test/billing-reading.test.ts`, `bun test src/test/billing-invoice.test.ts`, `bun test src/test/renter-auth.test.ts`, `bun test src/test/renter-portal.test.ts`, `bun test src/test/payment-proof-schema.test.ts`.
- [ ] For billing-invoice mismatch, record exact test title, failing line, expected and actual values, and SQL-visible persisted invoice values. Follow contract/renter room selection, readings, prices, fees, rounding, and whether a rerun overwrites draft/paid state. Do not guess or update expectation yet.
- [ ] For migration state, record file prefix/tag, journal idx/tag/timestamp, and applied migration tags on a disposable DB. Identify whether `0015_rate_limit_buckets.sql` or `0016_rate_limit_buckets.sql` was ever applied in QA/deployed history using non-destructive metadata/read-only evidence. No schema resets on shared DB.
- [ ] `backend/src/db/migrate.ts` invokes Drizzle's PostgreSQL migrator on `backend/drizzle`; inspect Drizzle's current configured migration schema/table and journal tag-to-SQL resolution before writing applied-tag queries. Do not assume `drizzle.__drizzle_migrations` exists. Record actual migration ledger name and query.
- [ ] From repository root, run `cd backend && bun run typecheck`, then each `cd backend && bun test src/test/<file>.test.ts` as separate sequential commands; do not run DB-resetting suites concurrently.
- [ ] Since current journal has both idx 15 payment settlement and idx 16 rate limits, verify “missing journal” claim against historical/deployed journal. If the discrepancy cannot be resolved with available non-destructive evidence, mark upgrade compatibility unresolved; do not infer what has been deployed.

## Task 2: Fix meter optimistic-lock timestamp precision and error ordering

**Files:** `backend/src/modules/billing/billing.service.ts`; `backend/src/test/billing-reading.test.ts`.

- [ ] Add DB regression where `expectedUpdatedAt` differs from persisted `updatedAt` by sub-millisecond precision while JS `Date` comparison would collapse the distinction; assert stale write returns `READING_CONFLICT` and row stays unchanged.
- [ ] Add explicit deleted/missing meter row case expecting `NOT_FOUND`, plus stale existing row case expecting `READING_CONFLICT`. For batch input with a prior valid item and later missing/stale item, assert transaction rollback leaves every reading unchanged.
- [ ] Reproduce first. Choose one canonical comparison: preserve timestamp precision in wire format/DB comparison or compare an explicit version token; do not truncate DB precision into a false match. Keep compare-and-swap predicate in SQL and return latest conflict detail.
- [ ] Ensure missing row is resolved before version comparison and remains `NOT_FOUND`; stale version on a present row remains `READING_CONFLICT`. Do not convert all zero-row updates to one generic error.
- [ ] Run `cd backend && bun test src/test/billing-reading.test.ts`; verify exact tests pass and rollback remains atomic.

## Task 3: Repair lazy-query execution gaps in constraint coverage

**Files:** `backend/src/test/payment-proof-schema.test.ts`; inspect other constraint tests for the same mistake, especially `backend/src/test/schema-constraints.test.ts`.

- [ ] Inventory each Drizzle insert/update/delete/query builder in these test files; for calls whose thenables are only constructed, add `.execute()`, `.returning()`, or `await` in a way that actually executes SQL.
- [ ] Keep `await expect(actualExecutedQuery).rejects.toThrow()` for violating values. Use valid control inserts and assert persisted rows where applicable.
- [ ] Run `cd backend && bun test src/test/payment-proof-schema.test.ts` and `bun test src/test/schema-constraints.test.ts` separately; verify each targeted invalid write fails at DB boundary and valid replacement/history cases persist.

## Task 4: Diagnose and correct invoice assertion mismatch using trace

**Files:** `backend/src/test/billing-invoice.test.ts`; likely `backend/src/modules/billing/billing.service.ts` or `backend/src/modules/billing/billing.calculation.ts` only if trace proves defect.

- [ ] Re-run the exact failing test from Task 1 alone. Capture complete assertion diff and query persisted invoice snapshots after first generation, draft rerun, and paid rerun.
- [ ] Compare exact source inputs: active billable contract, room, previous/current readings, motel prices, `otherFees`, and calculation output. Confirm numeric string normalization and total equals rent + electricity + water + fees.
- [ ] If code violates contract, add/adjust a narrow regression first, fix the source behavior, and retain exact invoice snapshot and paid-state preservation assertions. If fixture expectation is stale, update only the incorrect expected assertion and explain evidence in test naming/fixture data (no code comments).
- [ ] Run `cd backend && bun test src/test/billing-invoice.test.ts` followed by `bun test src/test/billing-calculation.test.ts` sequentially.

## Task 5: Resolve renter-auth URL/config expectation

**Files:** `backend/src/test/renter-auth.test.ts`; inspect `backend/src/shared/magic-link.ts`, `backend/src/config.ts`, `backend/src/env.ts`; implementation change only if proven.

- [ ] Capture failing URL assertion with redacted config diagnostics: configured base origin/path shape only, never token or credentials in logs. Inspect how config normalizes trailing slash and how `issueMagicLink` builds route.
- [ ] Assert intended `/r/[token]` landing path against configured `renterPortalUrl`; preserve exact token placement and avoid duplicate slash. If config contract permits trailing slash, cover both normalized input forms without printing config secret values.
- [ ] Distinguish mismatch in test expectation from wrong env/config key or incorrect URL generation. Change only owning layer; do not hardcode a host or weaken assertion to substring matching.
- [ ] Run `cd backend && bun test src/test/renter-auth.test.ts` alone, then verify no token appears in failure diagnostics beyond the intentional generated URL assertion.

## Task 6: Fix renter-portal relative Request construction

**Files:** `backend/src/test/renter-portal.test.ts`.

- [ ] Replace relative path Request inputs at lines 106 and 109 with absolute `http://localhost/api/renter/invoices/${id}` URLs, matching existing absolute-URL calls in the same test file.
- [ ] Keep own-invoice success and foreign-invoice 404 assertions, plus unchanged-state assertion. Do not change route semantics to accommodate invalid Fetch input.
- [ ] Run `cd backend && bun test src/test/renter-portal.test.ts` alone.

## Task 7: Correct migration collision and verify clean install plus upgrade

**Files:** `backend/drizzle/0015_rate_limit_buckets.sql`, `backend/drizzle/0015_payment_settlement.sql`, `backend/drizzle/0016_rate_limit_buckets.sql`, `backend/drizzle/meta/_journal.json`; add a forward migration with a unique next sequence only if evidence requires it.

- [ ] Inspect `backend/src/shared/rate-limit.ts`, rate-limit service/store code, all references to `rate_limit_buckets`, schema declarations, migration snapshots, journal, and live applied migration tags. Write down intended columns/constraints and compare each migration's `CREATE TABLE` shape.
- [ ] Confirm whether `0015_rate_limit_buckets.sql` is unjournaled/unapplied legacy file, an already-applied migration, or intended predecessor. Confirm whether duplicate-prefix filenames confuse current runner even though journal points at only tags `0015_payment_settlement` and `0016_rate_limit_buckets`.
- [ ] Preserve migrations already applied anywhere. Do not rewrite applied SQL or remove an existing journal record. If no released/deployed DB has applied the conflicting artifact, choose a unique, sequential authoritative migration/journal entry and retire only demonstrably unreferenced duplicate. Otherwise create an additive forward migration that reconciles intended schema safely and is idempotent only where project conventions require it.
- [ ] Build two disposable PostgreSQL verification databases: (1) empty database, run `cd backend && bun run db:migrate`, confirm all journal entries apply once and final `rate_limit_buckets` schema matches active code; (2) upgrade fixture initialized through the prior known migration set and representative pre-existing rate-limit data, run current migration command without reset, confirm data preservation, expected columns/constraints, and no duplicate-object failure.
- [ ] Run migration verification sequentially; never run reset/migrate tests concurrently. Capture applied tags and schema inspection, not credentials or data payloads. Avoid `db:push` and never use QA/production reset.
- [ ] Run `cd backend && bun run db:generate` only if schema source changed; inspect generated artifacts and do not accept destructive snapshot churn unrelated to intended migration.

## Task 8: Sequential backend verification and final safeguards

**Files:** Only issue-specific files above; documentation changes only if behavior/migration contract changes.

- [ ] Run `cd backend && bun run typecheck`.
- [ ] Run DB suites sequentially, one process at a time: `bun test src/test/billing-reading.test.ts`; `bun test src/test/payment-proof-schema.test.ts`; `bun test src/test/schema-constraints.test.ts`; `bun test src/test/billing-invoice.test.ts`; `bun test src/test/billing-calculation.test.ts`; `bun test src/test/renter-auth.test.ts`; `bun test src/test/renter-portal.test.ts`. No parallel invocations because every file's `beforeEach(resetDb)` drops schemas.
- [ ] Run remaining full backend suite only after confirming no other session is testing same DB: `cd backend && bun test` (Bun's parallel file execution may interleave schema resets; if it does, use the project's documented sequential file runner/full-flow order rather than treating cross-talk as product defect).
- [ ] Recheck `git status --short`, `git diff --check`, changed-file list, ignored env presence, and PR #12 state/checks. Confirm frontend/UI files and `.env` unchanged and untracked/ignored secrets not staged.
- [ ] Record command, timestamp, SHA, test counts, DB target class (disposable local only), migration fresh/upgrade result, and any environment blocker in final report.

## Commit discipline

Commit issue fixes only after the tests and migration checks pass. Stage explicit backend paths; never use `git add .`. Before commit inspect `git status`, `git diff`, and `git log --oneline -10`. Keep this plan-only commit separate from later implementation commits if this plan is being executed afterward.
