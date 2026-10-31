# Production Superadmin and Shared Contract Catalog Design

**Status:** Approved direction; implementation spec.  
**Date:** 2026-10-27  
**Scope:** One hidden Superadmin bootstrap, direct manager account/password administration, and shared Vietnamese contract-template catalog. No motel wizard; bootstrap creates no motel or manager account.

## 1. Goal and decisions

- Seed canonical operator account `superadmin@motel.huyndg.io.vn` with role `superadmin` through explicit one-shot `bun run db:seed-system` after migrations. `SUPERADMIN_PASSWORD` comes from protected Dokploy runtime secret injection. Superadmin manages accounts and catalog only; cannot access motel/business APIs.
- Superadmin creates normal manager accounts directly with email, name, password (8–256 chars), and optional phone. Hash immediately with Argon2id. Manager signs in directly via `/login` without email/token setup flow.
- Superadmin can reset manager passwords directly. Reset, disable, and re-enable increment `sessionVersion`, invalidating existing JWTs. Re-enable allows login with the last set password.
- Managers retain all business permissions inside their own tenant. Cross-tenant access continues returning 404.
- Existing public `/api/auth/register` remains available for normal-manager self-registration. Server always assigns `role=manager` and rejects/ignores role input; Superadmin creation remains operator-only and separate.
- Seed three centrally managed, versioned Vietnamese contract templates. Managers may view and copy a version into a motel they own. Each copy is a distinct motel-owned template; contracts continue snapshotting clauses.
- Bootstrap does not create a normal manager, motel, room, renter, invoice, payment, meter reading, ticket, or setup wizard.

## 2. Existing constraints

- `contract_templates.motel_id` is required and FK-owned by a motel; existing contract creation checks that template and motel belong to the same tenant.
- Current `main` has a public `/api/auth/register`; preserve it for ordinary manager onboarding and add tests confirming it can create only role `manager`, never Superadmin.
- Existing project decisions require tenant scope from session, 404 for foreign tenant resources, strict TypeScript, Argon2id, and module-owned tables/services.
- Backend tests use real PostgreSQL; run serially against a verified disposable local test database. Never reset QA or Prod.
- Production migration stage was run earlier, followed by restoring `dockerBuildStage=""` (`runner`). Recheck schema/API health before any bootstrap. Do not change migration mode or rerun one-shot migrations blindly.
- Dokploy earlier showed completed DB records unavailable through generic describe/get calls and existing database logs fail `Missing postgresId`; only use engine-specific IDs discovered from fresh `list/search` results. No schema assumptions based only on deploy status.
- Prod had R2 env propagation failures. Before deploying BE, verify `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET` are present in stored runtime env and verify the deployed task starts; never print values.
- Zalo is optional only when `ZALO_OA_ID` is absent. Partial Zalo credentials are invalid; when disabled, webhook must return non-disclosing 404 before signature/body processing.

## 3. Database model

### Managers

Extend `managers` with:

- `role` PostgreSQL enum `manager_role=('manager','superadmin')`, default `manager`.
- `disabled_at` nullable timestamptz.
- `session_version` nonnegative integer default 0.
- `password_hash` remains NOT NULL; every account has an Argon2id hash.
- Preserve unique lowercase email and existing manager data.

Add auth-owned `manager_audit_events` with actor/target IDs, action, timestamp. Account mutation and bootstrap audit inserts are transactionally atomic with the state change. Never record passwords, hashes, or credential payloads. Do not add setup-token tables or setup-link behavior.

### Contract template catalog

Add `contract_template_catalog` to contract module:

- `id uuid` PK, `key text`, positive `version`, localized `name` and `description`, `clauses jsonb` typed `ContractTemplateClause[]`, `active boolean` default true, timestamps.
- Unique `(key, version)`; DB checks for key/version/non-empty name/array clauses.
- v1 keys: `vn-residential-standard`, `vn-flexible-term`, `vn-service-fees`.
- Seed catalog via insert-on-conflict-no-op; never overwrite existing content or active state. Wording changes require new version.

## 4. Backend APIs and access rules

### Superadmin-only

- `GET /api/admin/managers?limit=50&offset=0`: list normal managers only; never include hashes or Superadmin; return current session-bound `X-CSRF-Token`.
- `POST /api/admin/managers`: `{ email, name, password, phone? }`; normalize email, validate name/phone/password, hash Argon2id, insert active Manager. Return safe profile only. Superadmin cannot claim the reserved `superadmin@motel.huyndg.io.vn` identity.
- `PATCH /api/admin/managers/:managerId`: `{ enabled: boolean }`; target must be manager, otherwise 404. Any status change increments session version, revoking existing sessions; disable blocks login.
- `POST /api/admin/managers/:managerId/reset-password`: `{ password }`; target must be manager; hash, increment session version, audit atomically.
- All writes require current CSRF token, rate limiting, and transactionally consistent audit. Superadmin cannot promote/create another Superadmin via these routes.
- Superadmin cannot reset its own credential through manager-account APIs. Recovery for the single hidden Superadmin remains an operator-only manual procedure outside this feature.

### Manager catalog endpoints

- `GET /api/manager/contract-template-catalog`: list active summary entries. Normal managers use manager auth. Superadmin may use an explicit catalog-read route or this route only if authorization is added deliberately; never grant Superadmin business access.
- `GET /api/manager/contract-template-catalog/:key/:version`: active template and clauses.
- `POST /api/manager/motels/:motelId/contract-templates/from-catalog`: `{ catalogKey, catalogVersion, name?, isDefault? }`. Manager auth, resolve owned motel first, load active catalog row, copy clauses into motel-owned table in one transaction. No arbitrary clause payload. Setting default affects only that motel.
- Catalog deactivation/updates do not modify copied rows or existing contracts. Unknown/inactive catalog and foreign motel return 404.

## 5. One-shot system seed

Command: `bun run db:seed-system`, explicitly invoked after database migrations complete.

- Canonical identity: `superadmin@motel.huyndg.io.vn`, display name `Motel Platform Admin`; `SUPERADMIN_PASSWORD` comes from protected Dokploy runtime secret injection. Never pass password as a CLI argument or write it to logs, source, deployment descriptions, output, or reports.
- The system seed does not run migrations and is not imported or invoked by backend startup. Startup must not require `SUPERADMIN_PASSWORD` or create system/demo data.
- Before invocation, perform read-only preflight for an existing canonical email and inspect role/enabled state without reading password hashes. A Manager collision, disabled Superadmin, or password mismatch aborts with zero writes. Never promote, enable, rename, delete, or reset an existing account automatically.
- If the identity is absent, insert one active Superadmin with Argon2id and safe audit event. If enabled Superadmin exists and supplied password verifies, account operation is a no-op.
- Seed three catalog v1 rows idempotently; do not create manager, motel, or business rows. Any error rolls back account/catalog writes. Never invoke destructive `backend/src/db/seed.ts` as the system seed.
- The destructive demo seed is QA-only and requires both `APP_ENV=qa` and explicit `SEED_DATABASE=true`; never run it in Prod.
- QA deployment and seed do not authorize Prod changes. Prod deployment and system seed require separate explicit approval and a fresh read-only identity/schema preflight.

## 6. UI

- Login returns role; Superadmin redirects to `/admin/managers`, Manager to standard dashboard.
- Admin manager UI lists/creates/resets/disables/re-enables normal Managers only. Password fields use type=password and values never echoed. No role editing, second Superadmin controls, tenant data, or renter/billing navigation.
- Manager contract UI exposes system catalog templates to preview/copy into owned motel; no motel-creation wizard in this scope.

## 7. Validation and test requirements

- DB tests: session version nonnegative, catalog key/version uniqueness and checks enforced by PostgreSQL. This design adds no global uniqueness constraint on Superadmin role.
- Auth HTTP tests: Superadmin can access admin operations and is denied motel/business; Manager is denied admin; public `/api/auth/register` remains available but always creates role `manager`; reset/disable invalidate existing session cookies; CSRF failures reject writes.
- Account tests: direct manager creation/login, duplicate normalized email, min/max password, disable/re-enable, reset audit/session version, safe responses and output.
- Catalog tests: active list/detail, inactive 404, owned motel copy, foreign motel 404, copy independence after source change, per-motel default only.
- System-seed tests: invalid/missing password refusal; canonical Superadmin creation and matching rerun idempotency; mismatch/role conflict abort without writes; concurrent invocation safe; catalog seeded once; zero manager/motel/business inserts; rollback on failure; secret sentinel absent from output/audit.
- Run BE typecheck/lint/focused DB tests serially on verified disposable local DB; frontend typecheck/lint/build/unit; E2E only when affected UI. Independent security/code review before Prod execution.

## 8. Production gates and out of scope

- Configure Dokploy runtime task env (DB/JWT/R2) without exposing values. Verify migration completion before system seed; the seed does not run migrations.
- System seed is explicit one-shot via `bun run db:seed-system` with protected `SUPERADMIN_PASSWORD`. Perform read-only canonical-email preflight first. Verify canonical Superadmin and three active catalog rows; assert no manager/motel/business rows were created. Identity conflict blocks execution without writes.
- Backend startup has no seed side effects. Destructive demo seed is QA-only with both `APP_ENV=qa` and `SEED_DATABASE=true`; never run it on Prod.
- QA work does not include Prod deployment or mutation. A future Prod ship requires separate explicit approval, fresh read-only preflight, migrations before seed, protected Dokploy secret, and explicit verification.
- No manager/motel seed, wizard, setup token/link, default password, direct shared-template attachment, legal-certification claim, public domain changes, or launch in scope. Existing public manager registration remains, but must be verified to create only role `manager`.
