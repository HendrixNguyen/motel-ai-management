# Full-Flow Verification Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Turn the full-flow verification matrix into executable backend, frontend, E2E, security, and QA deployment checks.

**Architecture:** Add tests alongside each owning domain, then add one fixture-backed cross-route journey and one gated real-stack smoke journey. Keep backend schema-reset tests sequential and keep provider/R2 tests deterministic through fake adapters plus explicit sandbox gates.

**Tech Stack:** Bun test, PostgreSQL, Elysia `app.handle`, Vitest, Playwright, Dokploy QA, fake R2/Zalo adapters.

**Spec:** `docs/full-flow-test-plan.md`

## Global Constraints

- Every behavior change has a test.
- DB constraint and tenant tests use real PostgreSQL and HTTP boundaries.
- Backend reset tests never run concurrently.
- Fixture E2E must not require backend/database.
- Real-stack E2E requires `E2E_REAL=1`.
- Blocked environment checks remain blocked, never reported passed.
- Tests must not persist or print secrets, OTP plaintext, provider tokens, object keys, or signed URLs.

## Review Focus

- A test must fail for the intended reason, not merely because route or fixture is missing.
- Cross-tenant tests must use real foreign rows and valid sessions, not nonexistent IDs.
- Full-flow assertions must verify state transitions and redaction, not only HTTP status.
- Retry/idempotency tests must prove no duplicate invoice, notification, upload, or activation side effect.
- Browser offline tests must prove persistence across reload and reconnect, not only mocked in-memory state.

### Task 1: Backend test harness and seed fixtures

**Files:**
- Create: `backend/src/test/full-flow-fixtures.ts`
- Modify: `backend/src/test/test-utils.ts` if present
- Test: `backend/src/test/full-flow-fixtures.test.ts`

- [ ] Define Manager A/B, Motel A/B, rooms, renters, contracts, periods, invoices, and follower states with real FK rows.
- [ ] Assert fixture IDs differ and sessions resolve correctly.
- [ ] Run fixture test RED, implement minimal reusable setup, run GREEN.
- [ ] Commit `test: add full-flow backend fixtures`.

### Task 2: Backend contract and upload matrix

**Files:**
- Create/modify: `backend/src/test/upload.test.ts`, `backend/src/test/contract-paper.test.ts`

- [ ] Add failing tests for valid/invalid magic bytes, size/count, signed URL authorization, paper activation, immutability, and future dates.
- [ ] Run targeted tests RED.
- [ ] Implement/fix only owning code until GREEN.
- [ ] Run schema constraints, upload, contract, signing tests sequentially.
- [ ] Commit `test: cover contract proof and private uploads`.

### Task 3: Backend billing/capture matrix

**Files:**
- Create/modify: `backend/src/test/capture.test.ts`, `backend/src/test/billing-full-flow.test.ts`

- [ ] Test period creation, meter seed, atomic batch, lower reading rejection, stale conflict details, photo linkage, invoice generation/idempotency, sent lock, payment idempotency, and QR payload.
- [ ] Watch RED before fixes.
- [ ] Run GREEN sequentially against disposable DB.
- [ ] Commit `test: cover billing and capture lifecycle`.

### Task 4: Backend renter portal/ticket matrix

**Files:**
- Create: `backend/src/test/renter-portal.test.ts`, `backend/src/test/ticket.test.ts`

- [ ] Test magic-link exchange/replay/expiry, own profile/invoices/contracts, foreign resource 404/empty scope, response redaction, ticket attachments, manager-note exclusion, and provider failure isolation.
- [ ] Run RED, implement missing behavior, rerun GREEN.
- [ ] Commit `test: cover renter portal isolation and tickets`.

### Task 5: Backend Zalo and notification matrix

**Files:**
- Create: `backend/src/test/zalo.test.ts`, `backend/src/test/notification-integration.test.ts`

- [ ] Test webhook signatures, follow/unfollow idempotency, OA/ZNS selection, transient retry, permanent failure, dedupe event keys, provider IDs, and secret/OTP redaction.
- [ ] Run RED, then GREEN with fake provider.
- [ ] Commit `test: cover Zalo delivery and retries`.

### Task 6: Frontend unit/state matrix

**Files:**
- Create: `frontend/src/lib/capture/*.test.ts`, renter/Zalo model tests
- Modify: existing API fixture tests

- [ ] Test queue persistence/retry/conflict/lock/logout, upload validation, magic-link errors, QR rendering state, OTP states, ticket form, and safe provider errors.
- [ ] Run Vitest RED then GREEN.
- [ ] Commit `test: cover capture and renter client states`.

### Task 7: Fixture-backed browser flows

**Files:**
- Create: `frontend/e2e/capture.spec.ts`, `frontend/e2e/renter-portal.spec.ts`, `frontend/e2e/zalo-failure.spec.ts`, `frontend/e2e/full-flow.spec.ts`
- Modify: `frontend/e2e/fixtures/*`

- [ ] Add fixtures for manager setup, billing, renter exchange, contract OTP, tickets, and notification failures.
- [ ] Write browser tests at 375px for offline reload/reconnect, invoice QR, OTP, ticket creation, expired session, keyboard focus, and no secret text.
- [ ] Run each spec RED, then full fixture E2E GREEN.
- [ ] Commit `test: add fixture-backed full-flow browser coverage`.

### Task 8: Real-stack and deployment smoke

**Files:**
- Create: `frontend/e2e/real/full-flow.spec.ts`, `docs/qa/full-flow-runbook.md`
- Modify: `frontend/playwright.config.ts` if needed

- [ ] Gate real-stack suite on `E2E_REAL=1`; verify health, manager setup, billing, renter exchange, and provider failure behavior against QA only.
- [ ] Add Dokploy health, migration, private R2, webhook signature, and rollback checks to runbook.
- [ ] Run only with configured QA stack; record blocked provider/browser dependencies explicitly.
- [ ] Commit `test: add QA full-flow smoke runbook`.

### Task 9: Security and final verification

**Files:**
- Modify: `docs/testing-strategy.md`, `docs/full-flow-test-plan.md`

- [ ] Run backend typecheck and every explicit backend test file sequentially.
- [ ] Run frontend typecheck, lint, build, Vitest, and fixture E2E.
- [ ] Run security/code review; fix Critical/Important findings with RED→GREEN tests.
- [ ] Run `git diff --check`, record SHA and evidence table, and commit `test: complete full-flow verification gates`.
