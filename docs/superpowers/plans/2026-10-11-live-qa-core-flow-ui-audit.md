# Live QA Core-Flow and Payment UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify manager/renter billing and payment workflows through real browser interactions against QA, enforce a 5 MB payment-proof cap across the stack, and add manager proof-review/cash UI for existing APIs.

**Architecture:** Renter proof upload/status UI and payment API endpoints already exist. Update the payment-proof-specific limit to 5,000,000 bytes without changing meter/ticket/contract limits; add minimal manager callers/UI for existing proof review, approve/reject, and cash endpoints; retain the legacy generic paid route as unsupported. Add real-stack Playwright coverage behind fail-closed QA mutation gates, with unique run-scoped resources and separate invoices for irreversible approve, reject/resubmit, and cash branches.

**Tech Stack:** Bun, Next.js 16.3.8, ElysiaJS, Playwright 1.63, existing frontend component/API patterns.

**Spec:** `docs/superpowers/specs/2026-10-11-live-qa-core-flow-ui-audit-design.md`

## Global Constraints

- QA only. No production access, deploy, destructive reset, or mass cleanup.
- Reuse existing core UI and API behavior. Avoid adding CRUD that already exists.
- Use a dedicated QA motel and unique names/phone values; do not modify unrelated records.
- Create separate invoices for approve, reject/resubmit, and cash branches. Leave resulting audit/history data tagged and documented; do not attempt to reverse paid invoices.
- Clean up only resources created by test, only through UI-supported reversible operations where safe. If cleanup would delete or mutate historical data, leave tagged test records and document that.
- Keep tests independent from fixture-backed Playwright tests. Preserve `E2E_REAL=1` gating.
- Never put credentials, renter phone, OTP, magic-link token, signed URL, upload bytes, or payment data in test output or logs.
- Payment proof is exactly one private JPEG or PNG image, maximum 5 MB (5,000,000 bytes). Renter cannot change invoice payment state.
- Preserve API contract and backend invariants: tenant scope from session, cross-tenant 404, proof upload validation and one non-rejected proof per invoice, manager-only approve/reject/cash, idempotency for approved/cash-settled retries, and audit events.
- Require explicit `E2E_REAL=1`, QA base URL, manager login credentials, and explicit QA-only mutation confirmation before mutations. Fail fast when markers identify production. Never reset schemas or run deterministic destructive seed.
- `docs/api-contract.md` is authoritative; do not alter payment endpoint semantics without separate explicit decision.
- Run live journey against QA before changing product code. Record exact failing step, browser error, redacted request path/status, and commit SHA. For each product defect, add a regression test before smallest root-cause fix.

## Review Focus

- Production URL or environment marker is rejected before any mutation request.
- Missing QA mutation confirmation is rejected before login-driven writes.
- Error output, traces, or screenshots can expose renter identifiers, magic-link tokens, signed URLs, or uploaded image data; diagnostics must redact or avoid collection.
- Invoice/proof state transitions race or are retried; UI must reflect server truth and must not duplicate payment actions.
- Rejected proof replacement permits exactly one new proof, while pending/approved proof blocks another submission.

---

### Task 1: Verify Payment APIs and Current UI Gaps

**Files:**
- Read: `docs/api-contract.md`
- Read: `docs/testing-strategy.md`
- Inspect: `backend/src/modules/billing/`, `backend/src/modules/renter/`, `frontend/src/app/`, `frontend/src/components/`, `frontend/src/lib/api/`
- Modify: `docs/full-flow-test-plan.md` only if verified status needs updating

**Interfaces:**
- Consumes: documented routes listed in the spec.
- Produces: verified map of existing endpoints, frontend callers, missing UI, and focused tests needed; no product behavior changes. Confirmed baseline: renter proof upload/status UI and APIs exist; manager proof GET/approve/reject/cash APIs exist without callers/UI; legacy paid action targets a documented 410 route.

- [ ] **Step 1: Inspect current implementation and matching tests** for renter proof GET/POST, manager proof GET/approve/reject, and cash confirmation.
- [ ] **Step 2: Record UI gap map** naming existing route/component/API caller for each function; do not infer absence from file naming alone.
- [ ] **Step 3: Run focused backend tests sequentially** for relevant files found; capture exact existing pass/fail baseline.

Run from `backend/`: `bun run typecheck`, then each identified explicit test file one at a time.
Expected: existing backend contract status recorded; no concurrent reset-based tests.

- [ ] **Step 4: Stop and reconcile** if runtime endpoint semantics conflict with `docs/api-contract.md`; do not silently change backend contract.
- [ ] **Step 5: Correct stale status in `docs/full-flow-test-plan.md`**: distinguish implemented proof/cash APIs from missing manager UI and legacy paid route; payment flow remains unverified end-to-end until UI tests pass.
- [ ] **Step 6: Commit** inspection-backed documentation correction.

**Task 1 completion check:** Run `cd backend && bun run typecheck`; run `bun test src/test/billing-payment.test.ts` and `bun test src/test/payment-proof-schema.test.ts` sequentially. Expected: all pass; if dependencies or test database are unavailable, report blocked with exact cause and continue only with source-confirmed gaps, no claims that tests passed.

---

### Task 2: Add Renter Payment-Proof UI

**Files:**
- Modify: renter portal route/components identified in Task 1
- Modify: frontend API client module for renter billing only if no caller exists
- Test: colocated frontend unit test if API formatting/state logic is added
- Test: `frontend/e2e/full-flow.spec.ts` fixture test for UI interaction, if feasible with existing fixtures

**Interfaces:**
- Consumes: existing `validatePaymentProofFile(file: File)` and renter proof upload/status UI.
- Produces: `PAYMENT_PROOF_MAX_BYTES = 5_000_000`; payment proof accepts exactly one private JPEG/PNG up to 5,000,000 bytes; renter paid-state mutation remains absent. Backend validation/schema/migration and owning API/testing docs match. Meter photos, tickets, and contract proofs keep their separate limits.

- [ ] **Step 1: Write failing tests** in `frontend/src/lib/__tests__/payment-proof.test.ts` for 5,000,000 bytes accepted and 5,000,001 bytes rejected; update the payment proof UI assertion for `5 MB`.
- [ ] **Step 2: Run targeted tests and observe failures** at old 10 MiB behavior.

Run from `frontend/`: `bun run test -- src/lib/__tests__/payment-proof.test.ts` and the exact proof UI test file.
Expected: boundary assertions fail because current implementation accepts up to 10 MiB.

- [ ] **Step 3: Implement 5,000,000-byte client validation** in `frontend/src/lib/payment-proof.ts` and update renter upload copy.
- [ ] **Step 4: Add failing backend tests** for 5,000,000 bytes accepted and 5,000,001 rejected at route/service and DB constraint boundaries; retain image byte/MIME checks.
- [ ] **Step 5: Update only payment-proof server/schema/migration limits** and their owning API/design/testing docs to 5,000,000 bytes. Do not change shared storage default or meter/ticket/contract overrides. Generate migration using existing Drizzle workflow; ensure test reset table/schema remains consistent.
- [ ] **Step 6: Read relevant installed Next.js docs** under `frontend/node_modules/next/dist/docs/` before editing any Next.js page/component code. If dependencies/docs absent, report blocker; do not install or change dependencies without need.
- [ ] **Step 7: Run focused frontend and backend tests** and verify 5,000,000-byte boundary passes at each changed layer.
- [ ] **Step 8: Commit** policy/runtime/schema/migration/docs/tests together.

**Task 2 completion check:** Run targeted frontend proof unit/UI tests and backend payment-proof tests sequentially, plus frontend typecheck/lint and backend typecheck. Expected: 5,000,000 bytes accepted, 5,000,001 rejected across client, server and DB; unrelated resource upload limits unchanged.

---

### Task 3: Add Manager Proof Review and Cash UI

**Files:**
- Modify: manager billing/invoice route/components identified in Task 1
- Modify: frontend API client module for manager billing only if no caller exists
- Test: colocated frontend unit test for request/response handling if logic added
- Test: fixture Playwright scenario for approve/reject/cash interaction if existing fixtures support it

**Interfaces:**
- Consumes: documented manager endpoints for proof inspection, approve, reject-with-reason, and cash confirmation.
- Produces: manager UI scoped to selected motel and eligible invoice, showing proof/status; reject requires non-empty reason; approve and cash have distinct explicit actions and reflect returned payment state.

- [ ] **Step 1: Add failing tests** for proof visible to owning motel, rejection reason validation, approve/reject/cash action states, server conflict handling, and no renter-accessible payment mutation.
- [ ] **Step 2: Run targeted tests and observe failure.**

Run from `frontend/`: run the exact Vitest file and fixture Playwright spec identified by the new tests.
Expected: FAIL on missing manager review UI or behavior assertions.

- [ ] **Step 3: Read relevant installed Next.js docs** before editing Next.js code; use installed docs and existing code patterns only.
- [ ] **Step 4: Implement minimal manager review/actions** using existing billing views and APIs. Disable conflicting actions while requests are pending; refresh canonical server state after success/conflict. Preserve user-facing Vietnamese copy.
- [ ] **Step 5: Run exact targeted Vitest and fixture Playwright commands** and verify tests pass.
- [ ] **Step 6: Commit** manager UI and tests.

**Task 3 completion check:** Run exact Vitest and fixture Playwright tests added for review/cash UI, then `cd frontend && bun run typecheck && bun run lint`. Expected: manager state transitions and error handling pass; renter cannot trigger manager mutations; typecheck/lint clean.

---

### Task 4: Fail-Closed Live QA Gate and Core Flow

**Files:**
- Modify: `frontend/e2e/real/stack.spec.ts` or create `frontend/e2e/real/core-flow.spec.ts`
- Modify: `docs/testing-strategy.md` only if durable invocation contract needs updating

**Interfaces:**
- Consumes: `E2E_REAL=1`, `BACKEND_URL`, `E2E_LOGIN_EMAIL`, `E2E_LOGIN_PASSWORD`, and explicit `E2E_QA_MUTATIONS=1` confirmation; QA frontend configured by the existing Playwright port/base URL.
- Produces: preflight rejecting production hosts/environment markers and missing confirmation before mutations; unique tagged motel/room/renter; browser-driven persistence checks for supported core flow.

- [ ] **Step 1: Add failing safety tests** for missing confirmation, production-looking URL/environment, and no mutation requests before preflight pass.
- [ ] **Step 2: Run safety scenario with missing confirmation.**

Run from `frontend/`: `E2E_REAL=1 bunx playwright test e2e/real/stack.spec.ts --project=real-stack`.
Expected: fail fast naming `E2E_QA_MUTATIONS=1`; no writes sent.

- [ ] **Step 3: Implement preflight safety gate** and safe diagnostic redaction for credentials, renter phone, magic links, and signed URLs.
- [ ] **Step 4: Add UI-only motel/room/renter create and reload assertions** with run-unique labels; preserve login cookie/logout assertions from `stack.spec.ts` and attach console/network collectors that redact credentials, renter phone, tokens and signed URLs without storing request/response bodies.
- [ ] **Step 5: Run real-stack QA test** using dedicated QA config and confirmation.

Run from `frontend/`: `E2E_REAL=1 bun run test:e2e -- --project=real-stack`.
Expected: preflight passes only on confirmed non-production QA; create/reload persistence visible; no sensitive values in output.

- [ ] **Step 6: Commit** live-stack safety and core-flow tests.

**Task 4 completion check:** Run `cd frontend && bun run test:e2e -- --project=real-stack` with explicitly confirmed QA variables. Expected: all collected real-stack tests pass or fail only at an identified user-flow blocker; no write is sent if preflight rejects config.

---

### Task 5: Full Billing and Payment QA Journey

**Files:**
- Modify: `frontend/e2e/real/core-flow.spec.ts`
- Modify: `docs/full-flow-test-plan.md` if the verified flow status changes

**Interfaces:**
- Consumes: Tasks 2–4 renter and manager payment UI, live QA gate, and unique resources.
- Produces: browser journey for contract where supported, billing period, meter entry, invoice generation/finalization, renter magic-link portal, invoice details, proof reject/resubmit, proof approval, and cash confirmation.

- [ ] **Step 1: Add failing browser assertions** for each supported workflow, including exact invoice line items, reload persistence, proof status transitions and manager payment status.
- [ ] **Step 2: Add isolated data strategy** creating at least three new eligible unpaid invoices for distinct branches: (a) rejected then replaced proof, (b) approved proof, (c) cash confirmation. Use a generated valid non-personal image fixture ≤5,000,000 bytes. Never reuse/modify existing invoice or proof.
- [ ] **Step 3: Run journey against explicitly configured QA.**

Run from `frontend/`: `E2E_REAL=1 bun run test:e2e -- --project=real-stack` with QA-only frontend/backend URL, dedicated credentials, and `E2E_QA_MUTATIONS=1`.
Expected: visible interactions persist each expected state; paid invoices are separate and remain paid; proof state is pending→rejected→new pending on reject branch and pending→approved with invoice paid on approval branch; cash branch marks invoice paid by cash.

- [ ] **Step 4: For each reproduced defect, add a failing regression assertion, verify failure, fix smallest root cause, rerun affected scenario.** Capture only redacted request path/status and error category; avoid trace/screenshot artifacts containing PII or private image data.
- [ ] **Step 5: Classify unsupported contract create/send UI as a blocker** if confirmed absent; do not implement contract UI under this plan.
- [ ] **Step 6: Commit** live payment journey and directly reproduced fixes.

---

### Task 6: Verification and QA Report

**Files:**
- Modify: `docs/testing-strategy.md` or `docs/full-flow-test-plan.md` only when verified coverage contract changes
- Create: durable report only if the established reporting convention calls for it; otherwise include exact results in final task report

**Interfaces:**
- Consumes: completed focused backend and frontend checks plus QA run output.
- Produces: timestamp, SHA, QA environment label, exact commands, counts, pass/fail/blocker status, workflow stop point, and tagged QA data identifiers only; no credentials or renter sensitive values.

- [ ] **Step 1: Run backend typecheck, then relevant backend payment/isolation test files sequentially.**

Run from `backend/`: `bun run typecheck`, then focused test files discovered in Task 1, one at a time.
Expected: all applicable checks pass; shared DB reset tests never overlap.

- [ ] **Step 2: Run frontend checks in required order.**

Run from `frontend/`: `bun run typecheck`, `bun run lint`, `bun run build`, `bun run test`, then fixture `bun run test:e2e`.
Expected: each passes; unavailable Chromium OS libraries count as blocked with exact launch error.

- [ ] **Step 3: Run confirmed live QA suite** only with dedicated QA configuration and explicit confirmation.

Run from `frontend/`: `E2E_REAL=1 bun run test:e2e -- --project=real-stack`.
Expected: report exact pass/fail counts and first stop point; no secrets; all created QA records identifiable and retained when destructive cleanup is unsafe.

- [ ] **Step 4: Run `git diff --check` and inspect final diff** for unrelated changes, generated artifacts, secrets, and unsafe cleanup.
- [ ] **Step 5: Report** commands, timestamp, SHA, environment, outcomes, blockers, and intentionally retained QA records.

---
