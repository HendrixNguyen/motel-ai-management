# System Seed for Superadmin and Contract Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create explicit, safe system seeding for one Superadmin and shared contract templates, while ensuring demo data seed is QA-only and production startup seeds nothing.

**Architecture:** Replace startup-triggered Superadmin/catalog bootstrap with one explicit `bun run db:seed-system` operation that owns only the canonical Superadmin and versioned system template catalog. Keep destructive demo seeding separate and add an explicit QA-only guard; production startup and migration behavior remain separate.

**Tech Stack:** Bun 1.4, TypeScript, Elysia, Drizzle ORM, PostgreSQL, Bun Argon2id password hashing.

**Spec:** `docs/superpowers/specs/2026-10-30-system-seed-superadmin-contract-templates-design.md`

## Global Constraints

- Any identity conflict on Prod stops deployment/seed; make no account mutation until a separate explicit operator authorization is recorded.

- Canonical system email is `superadmin@motel.huyndg.io.vn`; display name `Motel Platform Admin`; role `superadmin`.
- Read `SUPERADMIN_PASSWORD` from protected Dokploy runtime environment for one-shot seed only; require 12–256 characters; never emit plaintext or hash.
- System seed creates only the canonical Superadmin and missing contract catalog versions; no business/demo data.
- Matching enabled Superadmin with matching canonical name and password is no-op; role/name mismatch, disabled account, or password mismatch fail without writes.
- Never promote, enable, rename, delete, or reset an existing account automatically.
- No DB uniqueness constraint limiting Superadmin count in this change.
- Remove `PRODUCTION_SUPERADMIN_CONFIRM`; no startup-triggered Superadmin or catalog writes.
- Demo seed requires `APP_ENV=qa` and `SEED_DATABASE=true`, and unconditionally rejects `NODE_ENV=production`.
- No QA or Prod DB reset. Do not mutate/deploy Prod.
- Use one backend DB test run at a time against verified disposable test DB; run `typecheck` before tests.
- Do not add dependencies or commit changes.

## Review Focus

- Empty, short, overlength, and whitespace-only `SUPERADMIN_PASSWORD` must fail before writes; seed tests assert zero account/catalog inserts.
- Existing canonical email with `role=manager`, wrong display name, disabled Superadmin, or mismatched password must fail with specific non-secret error and leave account/audit/catalog rows unchanged.
- Two concurrent system seed invocations must not create duplicate Superadmin/audit/catalog rows; test lock/idempotency.
- Demo seed must refuse in `production` and refuse QA unless explicit QA opt-in is present; test it never reaches delete statements on refusal.
- Registration email matching must be normalized and case-insensitive so `SuperAdmin@Motel.Huyndg.io.vn` cannot create a Manager.

---

### Task 1: Introduce explicit system seed command

**Files:**
- Create: `backend/src/db/seed-system.ts`
- Modify: `backend/package.json`
- Modify: `backend/src/modules/auth/superadmin-identity.ts`
- Test: `backend/test/bootstrap-superadmin.test.ts` (rename to `backend/test/seed-system.test.ts`)
- Modify: `backend/src/db/bootstrap-superadmin.ts` (remove after tests pass)

**Interfaces:**
- Consumes: `SUPERADMIN_EMAIL` and `SUPERADMIN_NAME` from `superadmin-identity.ts`; `seedContractTemplateCatalog(executor)` accepts the transaction executor.
- Produces: `export async function seedSystem(env: NodeJS.ProcessEnv = process.env, writeSummary: (message: string) => void = ...): Promise<{ superadminId: string; insertedCatalogKeys: string[] }>` in `seed-system.ts`.
- Command: `bun run db:seed-system` maps to `bun run src/db/seed-system.ts`.

- [ ] **Step 1: Write failing tests**
  - Rename existing bootstrap tests and update identity expectations.
  - Assert non-deployed mode is rejected, missing/short/overlength/whitespace-only secret rejects before writes, first run inserts one enabled Superadmin and all three catalog rows, same-secret rerun changes no account hash and inserts no catalog rows, and output excludes the secret/hash/id.
  - Assert canonical-email Manager, canonical Superadmin with wrong display name, disabled Superadmin, and wrong-password rerun each reject with a distinct reason and leave account/audit/catalog rows unchanged.
  - Assert system seed creates no motel or business rows; assert concurrent calls serialize and leave one canonical account.
- [ ] **Step 2: Run failing test**
  - Run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/seed-system.test.ts`
  - Expected: FAIL because system seed module/API is absent and current tests encode old confirmation behavior.
- [ ] **Step 3: Implement `seedSystem`**
  - Validate `NODE_ENV` is `production` or `staging`, and secret length is 12–256 with non-whitespace content before DB writes.
  - Verify required schema via existing direct table/column verification; use transaction advisory lock `hashtext('motel-superadmin-bootstrap')`.
  - If account absent, insert fixed email/name/role with Argon2id password hash and `superadmin.bootstrapped` audit event. If existing, require exact canonical name, enabled Superadmin role, and successful password verification; otherwise throw reason-specific safe errors.
  - Seed catalog inside same transaction using `seedContractTemplateCatalog(tx)`; preserve insert-on-conflict-no-op semantics.
  - Emit only fixed summary/counts. Do not run migrations in the seed command.
- [ ] **Step 4: Add package script and remove old module**
  - Add `"db:seed-system": "bun run src/db/seed-system.ts"` and remove `db:bootstrap-superadmin` script/import/module after all references move.
  - Main guard calls `seedSystem()`, reports only sanitized error message, closes DB connection on success/failure.
- [ ] **Step 5: Run focused test**
  - Run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/seed-system.test.ts`
  - Expected: PASS, including transaction rollback and no-secret assertions.

### Task 2: Isolate system seed from backend startup and reserve canonical email

**Files:**
- Modify: `backend/src/index.ts`
- Modify: `backend/src/modules/auth/auth.service.ts`
- Modify: `backend/src/modules/auth/admin-account.service.ts`
- Test: `backend/test/auth.test.ts` or existing auth registration test file
- Test: `backend/test/manager-auth.test.ts`

**Interfaces:**
- Consumes: `SUPERADMIN_EMAIL` from `superadmin-identity.ts`.
- Startup does not import or call `seedSystem`, `bootstrapSuperadmin`, or `seedContractTemplateCatalog`.

- [ ] **Step 1: Write failing auth tests**
  - Test public registration rejects normalized canonical email, including mixed-case input; verify no manager inserted.
  - Test Superadmin Manager creation API rejects normalized canonical email; verify response is conflict and no row inserted.
- [ ] **Step 2: Run auth tests to verify failures**
  - Run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/manager-auth.test.ts`
  - Expected: the new tests fail before the reserved-email checks use the canonical identity.
- [ ] **Step 3: Use canonical identity constant in all reserved-email checks**
  - Replace literal `manage@example.com` comparisons in `auth.service.ts` and `admin-account.service.ts` with imported `SUPERADMIN_EMAIL`; preserve lowercase normalization and existing conflict response conventions.
- [ ] **Step 4: Remove seed side effects from `src/index.ts`**
  - Delete `bootstrapSuperadmin` and catalog seed imports/calls from `AUTO_MIGRATE` startup path. Preserve `migrateDatabase()` behavior under the existing `AUTO_MIGRATE === "true"` gate. Startup must run without `SUPERADMIN_PASSWORD` and must not write system or demo seed data.
- [ ] **Step 5: Verify startup/auth tests**
  - Run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/manager-auth.test.ts`
  - Expected: PASS; reserved email cannot be registered/created as Manager, ordinary manager registration remains unchanged.

### Task 3: Guard destructive demo seed to QA only

**Files:**
- Modify: `backend/src/db/seed.ts`
- Test: Create `backend/test/demo-seed-guard.test.ts`
- Modify: QA seed invocation config/scripts only if an existing QA invocation is present; do not invent a deployment hook.

**Interfaces:**
- Demo seed entry point remains `seedData()` and direct `bun run src/db/seed.ts`.
- Add a small injectable guard `assertDemoSeedAllowed(env: NodeJS.ProcessEnv = process.env): void` in `seed.ts`; `seedData()` calls it before any DB write.
- Allowed only when `APP_ENV=qa` and `SEED_DATABASE=true`; reject `NODE_ENV=production`, unset/mismatched APP_ENV, or missing opt-in before first delete. `NODE_ENV` remains the standard runtime mode, while APP_ENV identifies QA vs Prod.

- [ ] **Step 1: Write failing guard tests**
  - Assert production with `APP_ENV=production`, staging, unset APP_ENV, QA without opt-in, and any non-QA mode reject without deleting existing manager/business rows.
  - Assert `NODE_ENV=production`, `APP_ENV=qa`, and explicit `SEED_DATABASE=true` can seed QA; assert QA plus opt-in performs existing deterministic seed behavior.
- [ ] **Step 2: Run focused tests to verify failures**
  - Run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/demo-seed-guard.test.ts`
  - Expected: FAIL because current guard only blocks `production` and production is the only explicit criterion.
- [ ] **Step 3: Add QA-only guard before all deletes**
  - Require `APP_ENV=qa` and `SEED_DATABASE=true` before `seedData()` reaches any delete statement. Explicitly reject `APP_ENV=production` and reject `NODE_ENV=production` unless the independent APP_ENV QA marker is exact; update error text without exposing environment secrets.
- [ ] **Step 4: Run focused seed tests**
  - Run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/demo-seed-guard.test.ts`
  - Expected: PASS; refusal paths leave DB untouched and QA opt-in still seeds deterministic demo data.

### Task 4: Reconcile documentation and deployment runbooks

**Files:**
- Modify: `docs/operations/production-startup.md`
- Modify: `docs/testing-strategy.md`
- Modify: `docs/superpowers/specs/2026-10-27-production-seed-shared-contract-catalog-design.md`
- Modify: `docs/superpowers/plans/2026-10-27-production-seed-contract-catalog.md`
- Modify: `backend/.env.example` if it lists `PRODUCTION_SUPERADMIN_CONFIRM` or `SUPERADMIN_PASSWORD` incorrectly

- [ ] **Step 1: Replace old bootstrap instructions**
  - Document migration then one-shot `bun run db:seed-system`; secret comes from protected Dokploy runtime secret; never pass password as CLI arg or log it; command does not migrate or run on backend startup.
- [ ] **Step 2: Document demo seed gate**
  - State demo seed is QA-only, requires `APP_ENV=qa` and explicit `SEED_DATABASE=true`, and must never run on Prod; include no invocation that could accidentally target Prod.
- [ ] **Step 3: Reconcile old spec/plan and testing contract**
  - Remove outdated fixed email, confirmation variable, startup bootstrap, one-Superadmin global constraint claims where contradicted by the approved new spec. Preserve unrelated approved decisions.
  - Testing strategy records system seed as explicit one-shot, startup without seed side effects, and QA-only destructive demo seed tests.
- [ ] **Step 4: Search for stale identifiers**
  - Run: `git grep -n -E 'manage@example.com|PRODUCTION_SUPERADMIN_CONFIRM|db:bootstrap-superadmin|bootstrapSuperadmin' -- backend docs`
  - Expected: zero references except historical QA findings if intentionally retained and clearly marked.

### Task 5: Full validation and safe rollout checklist

**Files:**
- No new source files. Update plan/spec checklist only if verification reveals an ambiguity.

- [ ] **Step 1: Run backend checks in required order**
  - Run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun run typecheck`
  - Expected: PASS.
  - Run separately and sequentially, never concurrently against the same DB: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/seed-system.test.ts`, then `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/demo-seed-guard.test.ts`, then `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/manager-auth.test.ts`.
  - Expected: each focused test file passes.
  - Then run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun run lint` and `bun run format:check`.
  - Expected: PASS.
- [ ] **Step 2: Inspect exact diff and stale references**
  - Run: `git diff --check && git status --short && git diff --stat`
  - Expected: no whitespace errors; only intended source/tests/docs changed.
- [ ] **Step 3: QA preflight only, no DB reset**
  - Read-only query checks canonical email existence, role, disabled status, and Superadmin count without retrieving hashes. Confirm `manage@example.com` remains Manager. If canonical identity already exists, stop and inspect before seed.
- [ ] **Step 4: QA rollout after implementation review**
  - Deploy code to QA only after explicit user approval; verify backend startup healthy with no bootstrap logs/crash-loop. Run migration job only if schema migration is pending; then run one-shot system seed with Dokploy QA secret through protected execution, never print the value.
  - Verify canonical Superadmin login, enabled state, three catalog templates, no business rows created by system seed, and QA demo data remains as expected.
  - Remove QA `SUPERADMIN_PASSWORD` from persistent runtime env only after seed/login success, preserving all other env values.
- [ ] **Step 5: Prod remains untouched**
  - Do not deploy or mutate Prod. Future Prod rollout requires separate explicit approval and fresh read-only preflight; resolve any identity conflict only through a separately authorized operator action.
