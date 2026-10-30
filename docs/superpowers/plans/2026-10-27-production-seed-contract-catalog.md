# System Seed for Superadmin and Contract Templates Implementation Plan

> **For agentic workers:** Use subagent-driven development or executing-plans. Execute task-by-task with TDD. Do not run Prod deployment, migrations, or system seed without separate explicit approval and secure one-shot secret injection.

**Goal:** Implement one hidden Superadmin (`superadmin@motel.huyndg.io.vn`), direct Manager account/password administration, and a shared contract catalog copied into motel-owned templates.

**Architecture:** Use explicit one-shot `bun run db:seed-system` after migrations to create/verify only the canonical Superadmin and missing versioned system template catalog. Keep destructive demo seeding separate behind exact QA-only opt-in; backend startup creates no system or demo seed data.

**Tech stack:** Bun, TypeScript, ElysiaJS, Drizzle/PostgreSQL, Next.js App Router, Vitest/Playwright.

**Spec:** `docs/superpowers/specs/2026-10-30-system-seed-superadmin-contract-templates-design.md`

## Global Constraints

- Canonical system email is `superadmin@motel.huyndg.io.vn`; display name `Motel Platform Admin`; role `superadmin`.
- Read `SUPERADMIN_PASSWORD` from protected Dokploy runtime environment for explicit one-shot seed only; never emit plaintext or hash.
- Migrations must complete before `bun run db:seed-system`; the command does not migrate.
- System seed creates only canonical Superadmin and missing contract catalog versions; no business/demo data. Backend startup has no seed side effects and does not require the password.
- Matching enabled Superadmin + matching password is no-op; role mismatch, disabled account, or password mismatch fail without writes.
- Never promote, enable, rename, delete, or reset an existing account automatically. Run read-only identity-conflict preflight before seed.
- No DB uniqueness constraint limiting Superadmin count in this change.
- Demo seed must be explicitly QA-only: require both `APP_ENV=qa` and `SEED_DATABASE=true`; never run on Prod.
- No QA or Prod DB reset. Do not deploy or mutate Prod as part of QA; a future Prod ship requires separate explicit approval.
- Use one backend DB test run at a time against verified disposable test DB; run `typecheck` before tests.
- Do not add dependencies or commit changes.

## Review Focus

- Empty, short, overlength, and whitespace-only `SUPERADMIN_PASSWORD` must fail before writes; seed tests assert zero account/catalog inserts.
- Existing canonical email with `role=manager`, disabled Superadmin, or mismatched password must fail with specific non-secret error and leave account/catalog unchanged.
- Two concurrent system seed invocations must not create duplicate Superadmin/audit/catalog rows; test lock/idempotency.
- Demo seed must refuse in production and refuse unless exact QA opt-in exists; test it never reaches delete statements on refusal.
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

- Consumes: `SUPERADMIN_EMAIL` and `SUPERADMIN_NAME` from `superadmin-identity.ts`; `seedContractTemplateCatalog(executor)` accepts transaction executor.
- Produces: `export async function seedSystem(env: NodeJS.ProcessEnv = process.env, writeSummary: (message: string) => void = ...): Promise<{ superadminId: string; insertedCatalogKeys: string[] }>` in `seed-system.ts`.
- Command: `bun run db:seed-system` maps to `bun run src/db/seed-system.ts`.

- [ ] **Step 1: Write failing tests**
  - Rename existing bootstrap tests and update identity expectations.
  - Assert deployed mode is accepted, missing/short/overlength/whitespace-only secret rejects before writes, first run inserts one enabled Superadmin and all three catalog rows, same-secret rerun changes no account hash and inserts no catalog rows, and output excludes secret/hash/id.
  - Assert canonical-email Manager, disabled Superadmin, and wrong-password rerun each reject with distinct reason and leave account/catalog rows unchanged.
  - Assert system seed creates no motel or business rows; assert concurrent calls serialize and leave one canonical account.
- [ ] **Step 2: Run failing test**
  - Run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/seed-system.test.ts`
  - Expected: FAIL because system seed module/API is absent and current tests encode old confirmation behavior.
- [ ] **Step 3: Implement `seedSystem`**
  - Validate deployed environment policy and secret length 12–256 with non-whitespace content before DB writes.
  - Verify required schema via existing direct table/column verification; use transaction advisory lock `hashtext('motel-superadmin-bootstrap')`.
  - If account absent, insert fixed email/name/role with Argon2id password hash and safe audit event. If existing, require enabled Superadmin and successful password verify; otherwise throw reason-specific safe errors.
  - Seed catalog inside same transaction using `seedContractTemplateCatalog(tx)`; preserve insert-on-conflict-no-op semantics.
  - Emit only fixed summary/counts. Do not run migrations in seed command.
- [ ] **Step 4: Add package script and remove old module**
  - Add `db:seed-system` script and remove deprecated bootstrap script/import/module after all references move.
  - Main guard calls `seedSystem()`, reports only sanitized error message, closes DB connection on success/failure.
- [ ] **Step 5: Run focused test**
  - Run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/seed-system.test.ts`
  - Expected: PASS, including transaction rollback and no-secret assertions.

**Review follow-up report:** Explicit missing `RETURNING` row check now throws a marked safe error before audit/catalog writes. Regression test verifies the actual marked name-conflict error maps to its fixed safe message. `bun run typecheck` and `bun test test/seed-system.test.ts` pass (9 tests). Missing-row regression verifies audit is not attempted; transaction-level rollback not directly asserted.

### Task 2: Isolate system seed from backend startup and reserve canonical email

**Files:**

- Modify: `backend/src/index.ts`
- Modify: `backend/src/modules/auth/auth.service.ts`
- Modify: `backend/src/modules/auth/admin-account.service.ts`
- Test: `backend/test/auth.test.ts` or existing auth registration test file
- Test: `backend/test/manager-auth.test.ts`

**Interfaces:**

- Consumes: `SUPERADMIN_EMAIL` from `superadmin-identity.ts`.
- Startup does not import or call `seedSystem` or `seedContractTemplateCatalog`.

- [ ] **Step 1: Write failing auth tests**
  - Test public registration rejects normalized canonical email, including mixed-case input; verify no manager inserted.
  - Test Superadmin Manager creation API rejects normalized canonical email; verify no row inserted.
- [ ] **Step 2: Run auth tests to verify failures**
  - Run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/manager-auth.test.ts`
  - Expected: new tests fail before reserved-email checks use canonical identity.
- [ ] **Step 3: Use canonical identity constant in all reserved-email checks**
  - Replace literal identity comparisons in `auth.service.ts` and `admin-account.service.ts` with imported `SUPERADMIN_EMAIL`; preserve lowercase normalization and existing conflict response conventions.
- [ ] **Step 4: Remove seed side effects from `src/index.ts`**
  - Delete any system/demo seed imports and calls from startup. Preserve `migrateDatabase()` behavior under existing `AUTO_MIGRATE === "true"` gate. Startup must run without `SUPERADMIN_PASSWORD` and must not write system or demo seed data.
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
- Allowed only when `APP_ENV=qa` and `SEED_DATABASE=true`; reject production, staging, unset/mismatched APP_ENV, or missing opt-in before first delete. `NODE_ENV` remains standard runtime mode, while APP_ENV identifies QA vs Prod.

- [ ] **Step 1: Write failing guard tests**
  - Assert production, staging, unset APP_ENV, QA without opt-in, and any non-QA mode reject without deleting existing manager/business rows.
  - Assert `NODE_ENV=production`, `APP_ENV=qa`, and explicit `SEED_DATABASE=true` can seed QA; assert QA plus opt-in performs existing deterministic seed behavior.
- [ ] **Step 2: Run focused tests to verify failures**
  - Run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/demo-seed-guard.test.ts`
  - Expected: FAIL because current guard only blocks production and production is the only explicit criterion.
- [ ] **Step 3: Add QA-only guard before all deletes**
  - Require exact `APP_ENV=qa` and `SEED_DATABASE=true` before `seedData()` reaches any delete statement. Refusal text must not expose environment secrets.
- [ ] **Step 4: Run focused seed tests**
  - Run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/demo-seed-guard.test.ts`
  - Expected: PASS; refusal paths leave DB untouched and QA opt-in still seeds deterministic demo data.

### Task 4: Reconcile documentation and deployment runbooks

**Files:**

- Modify: `docs/operations/production-startup.md`
- Modify: `docs/testing-strategy.md`
- Modify: `docs/superpowers/specs/2026-10-27-production-seed-shared-contract-catalog-design.md`
- Modify: `docs/superpowers/plans/2026-10-27-production-seed-contract-catalog.md`
- Modify: `backend/.env.example` only if needed; do not add `SUPERADMIN_PASSWORD` to normal runtime example values

- [ ] Replace old fixed account, confirmation variable, startup bootstrap, and one-Superadmin DB constraint claims with approved system seed behavior while preserving unrelated decisions.
- [ ] Document migrations before one-shot `bun run db:seed-system`, protected Dokploy `SUPERADMIN_PASSWORD`, read-only identity conflict preflight, no startup seed side effects, and secret non-disclosure.
- [ ] Document demo seed as QA-only with both `APP_ENV=qa` and `SEED_DATABASE=true`; never invoke it against Prod.
- [ ] Add explicit future Prod ship checklist; Prod requires separate approval and is never part of QA rollout.
- [ ] Ensure tests/docs contract covers system seed one-shot, startup without seed side effects, and QA-only destructive demo seed refusal before writes.
- [ ] Scan for stale identifiers and claims.

### Task 5: Full validation and safe rollout checklist

**Files:**

- No new source files. Update plan/spec checklist only if verification reveals an ambiguity.

- [ ] **Step 1: Run backend checks in required order**
  - Run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun run typecheck`
  - Expected: PASS.
  - Run separately and sequentially, never concurrently against same DB: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/seed-system.test.ts`, then `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/demo-seed-guard.test.ts`, then `cd backend && PATH="$HOME/.bun/bin:$PATH" bun test test/manager-auth.test.ts`.
  - Expected: each focused test file passes.
  - Then run: `cd backend && PATH="$HOME/.bun/bin:$PATH" bun run lint` and `bun run format:check`.
  - Expected: PASS.
- [ ] **Step 2: Inspect exact diff and stale references**
  - Run: `git diff --check && git status --short && git diff --stat`
  - Expected: no whitespace errors; only intended source/tests/docs changed.
- [ ] **Step 3: QA preflight only, no DB reset**
  - Read-only query checks canonical email existence, role, and disabled status without retrieving hashes. If canonical identity already exists, stop and inspect before seed.
- [ ] **Step 4: QA rollout after implementation review**
  - Deploy code to QA only after explicit user approval; verify backend startup healthy with no bootstrap logs/crash-loop. Run migration job only if schema migration is pending; then run one-shot system seed with protected Dokploy QA secret through protected execution, never print the value.
  - Verify canonical Superadmin login, enabled state, three catalog templates, no business rows created by system seed, and QA demo data remains as expected.
  - Remove QA `SUPERADMIN_PASSWORD` from persistent runtime env only after seed/login success, preserving all other env values.
- [ ] **Step 5: Prod remains untouched during QA**
  - Do not deploy or mutate Prod. Any future Prod ship requires separate explicit approval and current read-only identity/schema preflight.

## Future Prod ship checklist — separate approval required

This checklist is not part of QA execution. Do not deploy or mutate Prod unless the user separately approves the Prod ship.

- [ ] Verify approved release and change window; inspect Prod service and protected Dokploy secret configuration by key name only. Never expose secret values.
- [ ] Read-only preflight canonical email `superadmin@motel.huyndg.io.vn`, role, enabled state, and schema/migration status. Stop on identity conflict or unknown state; never inspect password hashes.
- [ ] Complete and verify migrations before seed; do not run migrations concurrently from replicas.
- [ ] Run `bun run db:seed-system` once with protected Dokploy `SUPERADMIN_PASSWORD`. Never pass it as CLI argument or log it. Seed itself does not migrate.
- [ ] Verify enabled canonical account, catalog rows, successful login/backend health, and no demo/business rows created by system seed.
- [ ] Never run destructive demo seed in Prod; exact QA gate is `APP_ENV=qa` plus `SEED_DATABASE=true`.
- [ ] Record outcome without credentials. Public routing/launch needs separate approval.
