# Production Superadmin and Contract Catalog Implementation Plan

> **For agentic workers:** Use subagent-driven development or executing-plans. Execute task-by-task with TDD. Do not run production migrations/bootstrap until merged main, healthy BE and secure one-shot secret injection are verified.

**Goal:** Implement one hidden Superadmin (`manage@example.com`), direct Manager account/password administration, and a shared contract catalog copied into motel-owned templates.

**Architecture:** Auth module owns manager role/session/audit and admin CRUD. Contract module owns a versioned read-only system catalog and transactional copy service. A protected idempotent CLI migrates, creates/validates only Superadmin, then seeds catalog; it creates no normal manager/motel/business data.

**Tech stack:** Bun, ElysiaJS, Drizzle/PostgreSQL, Next.js App Router, Vitest/Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-production-seed-shared-contract-catalog-design.md`

## Global Constraints

- Superadmin manages account/catalog only; manager business routes deny Superadmin. Managers retain full permissions only in own tenant; cross-tenant resource returns 404.
- One Superadmin maximum (`manage@example.com`), with Argon2id password. Managers direct-create/reset passwords through protected UI; no setup-link/token flow. Preserve public `/api/auth/register` for manager self-registration, but verify registration always assigns role `manager` and cannot set role.
- Bootstrap creates no manager/motel/business data, onboarding wizard, or demo data. Keep existing public manager registration, but assert it only creates role `manager`. No public route/launch changes in bootstrap scope.
- Catalog copy creates a distinct motel-owned template; never attach shared catalog row directly to contract/motel.
- Secrets never appear in argv, logs, source, deployment description, response, or audit. Do not call destructive QA seed on Prod.
- Backend tests use real PostgreSQL: run serially on verified disposable local test DB only. Production may omit `TEST_DATABASE_URL`; when present, it must not point to the same database as `DATABASE_URL`. Test mode continues to require it.
- Prod migration stage has been used; before rerunning, inspect migration status on DB safely and verify Dokploy engine-specific database IDs. Do not infer schema success from a `done` deployment; restore `runner` immediately after any required one-shot job, including failure.
- Reconcile Dokploy R2 runtime environment before any BE deployment; never expose values.

## Review Focus

1. Manager reset/disable increments sessionVersion and prior cookies fail subsequent requests.
2. Superadmin cannot read or mutate motel/business routes; Manager cannot access admin routes; registration only creates role `manager` and rejects role injection or reserved `manage@example.com`.
3. Catalog copy is transactionally tenant-owned and remains immutable from source changes; default changes only within target motel.
4. A normal Manager, disabled Superadmin, mismatched password, or concurrent bootstrap never leaves a partially seeded catalog/account.
5. Sentinel secrets never appear in responses, audit, stdout, or thrown error messages.

---

### Task 1: Schema migration and DB constraints

**Files:**

- Modify `backend/src/modules/auth/auth.schema.ts`, `backend/src/modules/contract/contract.schema.ts`, `backend/src/db/schemas.ts`, `backend/src/db/test-db.ts`, `backend/drizzle/meta/_journal.json`
- Create migrations/snapshots for manager-admin fields and contract catalog, numbering after the latest verified QA/main migration head. Existing working branch has draft 0026/0027 files; reconcile metadata and SQL against that head; no duplicate index/tag.
- Test `backend/test/schema-constraints.test.ts`

**Interfaces:** `managerRole` PostgreSQL enum, manager `role`, `disabledAt`, `sessionVersion`; `contractTemplateCatalog` (`id,key,version,name,description,clauses,active,createdAt,updatedAt`).

- [ ] RED: DB tests for exactly one Superadmin, sessionVersion >= 0, catalog `(key,version)` uniqueness and invalid catalog inputs rejected. Test that `password_hash` NULL is rejected by active schema/database.
- [ ] Run focused tests and verify they fail for missing schema constraints.
- [ ] Implement Drizzle schema and SQL migration; preserve manager hashes and `password_hash NOT NULL`; add `managerRole` enum, disabledAt/sessionVersion, partial Superadmin index. Include migration metadata and test reset list in FK order.
- [ ] Run focused DB constraints and backend typecheck.

### Task 2: Role-aware auth and direct Manager account APIs

**Files:** create `backend/src/middleware/admin-auth.ts`, `backend/src/modules/auth/admin-account.service.ts`; modify `backend/src/middleware/manager-auth.ts`, `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/auth/auth.route.ts`, `backend/src/app.ts`; tests `backend/test/admin-accounts.test.ts`, `backend/test/manager-auth.test.ts`.

**Existing state:** `admin-account.service.ts`, `auth.route.ts`, `admin-auth.ts`, and some auth tests already have draft changes. Reconcile these files to final spec; do not assume draft behavior/tests are correct.

**Interfaces:** `GET /api/admin/managers?limit=50&offset=0`; `POST /api/admin/managers {email,name,password,phone?}`; `PATCH /api/admin/managers/:managerId {enabled}`; `POST /api/admin/managers/:managerId/reset-password {password}`. Every write uses current session-bound CSRF token. Preserve `POST /api/auth/register` as ordinary-manager signup and explicitly force role=`manager` regardless of request body.

- [ ] RED: HTTP tests for public registration assigning only Manager role (including role injection and reserved-email attempts), Manager/Superadmin reciprocal role denial, direct Manager creation/login, duplicate normalized email, password bounds, reset/disable/re-enable revocation, CSRF errors, and no hash/secret in responses.
- [ ] Run focused tests, verify expected failures.
- [ ] Implement role lookup against DB, sessionVersion equality, active status and role checks. Preserve public `/api/auth/register` for onboarding; force role `manager` server-side, reject caller role, and block reserved `manage@example.com`. Keep `/auth/me` and logout for Superadmin; reject Superadmin on manager business routes. Retain direct DB fixture setup where a test specifically needs a pre-created account.
- [ ] Implement transactional account writes + audit; Argon2id; hide Superadmin from manager listing; map DB uniqueness to conflict without leaking account details; rate-limit account mutations. Keep self-registration but force manager role and reject reserved admin email.
- [ ] Run auth/tenant tests serially and typecheck.

### Task 3: System Contract Catalog and tenant copy

**Files:** create `backend/src/modules/contract/contract-catalog.service.ts`, modify `backend/src/modules/contract/contract.route.ts`, test `backend/test/contract-catalog.test.ts`; update `docs/api-contract.md`, design spec.

**Interfaces:** `listActiveContractTemplateCatalog`, `getActiveContractTemplateCatalog(key,version)`, `copyContractTemplateCatalogToMotel(motelId,managerId,input)`; routes `GET /api/manager/contract-template-catalog`, `GET .../:key/:version`, `POST /api/manager/motels/:motelId/contract-templates/from-catalog`.

- [ ] RED: tests for active list/detail, inactive 404, owner copy, foreign motel 404, copied clauses remain unchanged after catalog edit, per-motel default switch.
- [ ] Run tests and observe missing route/service failures.
- [ ] Implement 3 v1 Vietnamese templates: `vn-residential-standard`, `vn-flexible-term`, `vn-service-fees`; clauses cautious, no claims of legal certification or fabricated statutory quotes.
- [ ] Validate clauses via existing schema. Copy in transaction after resolving motel ownership. Never accept arbitrary clauses or attach catalog ID as contract template.
- [ ] Run focused tests/typecheck; document API/ownership/version behavior.

### Task 4: Superadmin UI, direct Manager credentials

**Files:** modify frontend login/manager layout/auth client/API types/form; create `/admin/managers` page; tests `frontend/test/app/admin-managers.test.tsx` and login tests; update `docs/frontend-ui-specs.md`.

- [ ] RED: tests role redirects, form submits password once, manager list does not expose Superadmin/hash, reset/disable confirmation, CSRF token passed on mutations, accessible keyboard/form behavior.
- [ ] Run focused tests and verify failure.
- [ ] Implement accessible manager CRUD/reset/disable UI; only role from `/auth/me` decides routing. Keep admin shell free of tenant motel data.
- [ ] Run frontend tests, typecheck, lint and production build.

### Task 5: One-shot Superadmin/catalog bootstrap

**Files:** create `backend/src/db/bootstrap-superadmin.ts`, modify `backend/package.json`, test `backend/test/bootstrap-superadmin.test.ts`, docs `production-startup.md`, `testing-strategy.md`.

**Command:** `bun run db:bootstrap-superadmin`; required `NODE_ENV=production`, `PRODUCTION_SUPERADMIN_CONFIRM=manage@example.com`, `SUPERADMIN_PASSWORD` via protected environment/stdin. Fixed identity; no motel fields.

- [ ] RED: tests non-prod refused; missing/invalid confirmation/password refused; Argon2id superadmin inserted once; same-secret rerun no-op; mismatching secret refuses without implicit reset; disabled/manager collision refuses; advisory lock handles concurrency; catalog seed idempotent/no overwrite; zero manager/motel/business writes; transaction rollback; sentinel secret absent from output/error.
- [ ] Run focused test and verify expected failures.
- [ ] Implement migration first; transaction advisory lock; account create/verify with fixed `manage@example.com`; manager/disabled/password mismatch aborts with no writes. Insert catalog rows `ON CONFLICT(key,version) DO NOTHING`. Print only fixed status and resource/counts. No HTTP seed route or destructive `db/seed.ts` import.
- [ ] Run bootstrap tests serially, typecheck/lint. Document protected one-shot secret method and recovery as separate procedure.

### Task 6: Release and guarded production bootstrap

**Files:** docs only as required; no product scope expansion.

- [ ] Run full BE typecheck/lint/test serially; full FE typecheck/lint/build/test; independent security and code review.
- [ ] Ensure patch branch is based on current main; publish reviewed PR; do not merge unless authorized.
- [ ] Verify Dokploy DB/network/backend env presence by key names only; never print secrets. Confirm R2 runtime task propagation and BE `/health` 200 before any seed.
- [ ] Inspect latest deployment state, the application’s build-stage field, and fresh engine-specific Postgres ID from search/list before any write. Do not use generic `get_database` (it is currently missing engine-ID args).
- [ ] Verify schema state with a read-only query using an existing authorized/secure operator path. If no such path exists, do not infer schema from service status. Only run migration job if migrations are not fully applied; capture success and restore runner immediately even on failure. Nonzero result blocks bootstrap.
- [ ] Run bootstrap once only after main contains reviewed code and protected secret injection is verified. Verify one enabled Superadmin and three active catalog rows; assert no manager/motel/business rows were created. If existing `manage@example.com` row is a Manager or any bootstrap precondition fails, expect zero writes and stop.
- [ ] Do not set public domains, deploy FE, seed business data, modify QA, or launch traffic from this task.

---

## Verification checklist

- [ ] Schema SQL and Drizzle snapshot/journal match; no duplicate migration index/tag.
- [ ] Tests prove RBAC, tenant isolation, session revocation, CSRF, DB constraints, catalog copy isolation, bootstrap idempotency and no side-effect rows.
- [ ] Backend test command only uses verified disposable DB and runs serially.
- [ ] No secret values in Git diff, logs, test output, artifacts, or final report.
- [ ] No Prod write until backend health and secret-safe operator execution gates pass.
