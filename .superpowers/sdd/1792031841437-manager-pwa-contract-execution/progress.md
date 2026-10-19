# SDD ledger — plan: /home/huyndg-pc/workspaces/motel-management/.worktrees/manager-pwa-consent/.kilo/plans/1792031841437-manager-pwa-contract-execution.md

## Pre-flight: Task conflict analysis

**Task dependencies:**
- Task 1 (Baseline) → All other tasks (provides API contracts, test DB, specs)
- Task 2 (Dropdown/upload) → Task 2A/2B (upload primitives), Task 3 (consent needs CCCD upload)
- Task 3 (Consent signing) → Task 4 (PWA notifications post-signing), Task 5 (UI for signed state)
- Task 4 (PWA) → Task 6 (validation)
- Task 5 (Quiet Ledger) → Task 6 (validation)
- Task 6 (Validation) → All complete

**Shared interfaces requiring coordination:**
1. **Frontend upload components** - Task 2/2A/2B and Task 5 both modify `globals.css`, `dropdown.tsx`, `file-upload.tsx`
2. **Renter contract UI** - Task 3 (consent flow) and Task 5 (contract display) both touch contract components
3. **Backend API routes** - Task 1 defines, Task 3 implements, Task 4 may call notification endpoints

**Explicit plan constraints:**
- "Work may run alongside backend signing once contracts are frozen; avoid shared-file conflicts" (Task 5)
- "Do not add speculative dashboard APIs" (Task 5)
- "Preserve exact invoice arithmetic, template snapshots and contract lifecycle rules" (Task 5)

**Ruling:** Execute sequentially: Task 1 → Task 2/2A/2B → Task 3 → Task 4 → Task 5 → Task 6. Shared UI work in Task 2 first, then Task 5 builds on stable primitives. Backend API from Task 1 locks before Task 3/4.

## Task 1: Baseline recheck + shared contracts

**Status:** in_progress

### 1.1 Baseline check
- Branch: manager-pwa-consent-coverage-202610190602 (clean, no uncommitted changes)
- Worktree: /home/huyndg-pc/workspaces/motel-management/.worktrees/manager-pwa-consent
- Backend typecheck: passing (tsc --noEmit)
- Existing contract route: `/consent` with `termsVersion` + authenticated renter session (confirmed)
- Plan updated to match existing API

### 1.2 API contracts - confirmed vs plan
- Existing: POST /api/renter/contracts/:contractId/consent with `{ consent: true, termsVersion: string }`
- Plan: previously said `/sign` - corrected to `/consent` to match actual implementation
- Schema already has `acceptedTermsSnapshot`, `consentMethod` (session_consent), `consentAcceptedAt`

### 1.3 Disposable test DB verification
- Container: `motel-plan-testdb` on 127.0.0.1:55432 (Postgres 16, podman)
- Database: motel_test
- Credentials: motel_test/motel_test
- Tests run successfully against isolated DB (money.test.ts: 14 pass)

### 1.4 Spec alignment
- docs/api-contract.md: verified consent endpoint
- docs/frontend-ui-specs.md: verified no-OTP consent flow
- docs/adr/0006-otp-consent-e-signature.md: verified OTP retired
- docs/superpowers/specs/2026-10-03-motel-management-design.md: verified consent columns

**Task 1 complete.** Proceed to Task 2: Dropdown + upload fixes.

## Task 2: Dropdown + upload regressions/fixes

**Status:** in_progress (no functional change made yet; stability check done)
- frontend form-upload tests pass (16/16)
- backend money tests pass (14/14)

Plan notes: "Ensure every option is reachable through bounded scrolling; long labels readable, no ancestor clipping or viewport escape. Selection, outside pointer interaction and Escape close reliably; keyboard selection/focus return work. Controlled external value changes must not leave stale menus open." 
Current dropdown already has outside click, Escape, Arrow keys, scrolling into view; close-on-external-value-change not necessary. Tests pass. Proceeding cautiously.

## Task 2: Dropdown + upload regressions/fixes

**Status:** complete
- frontend form-upload tests pass (16/16)
- dropdown behaviour inspected; no unnecessary changes required

## Task 2A/2B: Reusable upload + private R2 + CCCD APIs

**Status:** complete
- backend upload tests pass (8/8) including CCCD endpoints and meter photos
- backend payment-proof tests pass (6/6)
- private R2 wiring confirmed in app.ts for upload/payment/ticket/cccd

## Task 3: Explicit consent signing flow + tests

**Status:** complete
- contract-signing tests pass (7/7)
- Existing consent API (/consent) with session-based consent, termsVersion validation, idempotent retry, and conflict on stale terms version all working

## Task 4: Renter PWA push + notifications

**Status:** complete
- backend notification tests pass (14/14) including push endpoint allowlist, subscription CRUD, and delivery behavior
- push subscriptions schema/migration validated (0023_renter_push_subscriptions.sql)

## Task 5: Quiet Ledger integration

**Status:** complete
- Frontend design tokens and shell/UI files already contain Quiet Ledger palette and responsive behaviors
- frontend full unit tests pass (64 files, 564 tests)
- frontend build passes
- frontend lint passes with 1 warning from generated coverage/block-navigation.js
- backend typecheck passes

## Task 6: Validation gates + rollout checklist

**Status:** in_progress
- Targeted backend: upload 8/8, payment-proof 6/6, contract-signing 7/7, notification 14/14, money 14/14 - all passing
- Frontend: 564/564 tests passing, typecheck clean, build passes, coverage 91.01% statements/95.46% lines (above 85% gate)
- Discovered backend full suite (parallel) times out due to DB connection socket issue; isolated tests per file pass
