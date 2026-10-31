# Contract Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Deliver tenant-safe contract templates, manager contract lifecycle APIs, renter contract reads, and OTP consent signing.

**Architecture:** Extend existing contract module. Keep persistence and lifecycle in `contract.service.ts`, HTTP schemas/routes in `contract.route.ts`, and notification delivery behind a small exported seam so Zalo remains deferred. Add only minimal OTP persistence fields and migration.

**Tech Stack:** Bun, ElysiaJS, Drizzle ORM, PostgreSQL, TypeScript, bun:test.

**Spec:** `docs/superpowers/specs/2026-10-07-contract-management-design.md`

## Global Constraints

- Bun only.
- Cross-tenant denial returns 404.
- Money crosses HTTP as VND digit strings.
- OTP plaintext never persists or appears in responses/logs.
- Existing partial unique active-room constraint remains authoritative.
- Contract clauses snapshot at creation; later template edits do not mutate contracts.
- Zalo transport stays deferred; delivery failure leaves contract draft.

## Review Focus

1. Template default races cannot create two defaults — test unique constraint and transactional assignment.
2. Renter/room/motel mismatch cannot create a cross-tenant contract — test HTTP 404.
3. OTP replay, expiry, and three-attempt exhaustion cannot activate contracts — test each.
4. Concurrent verification cannot activate two contracts for one room — test transaction/unique constraint.
5. Delivery failure cannot mark contract sent or expose OTP — test seam failure and response.

### Task 1: OTP persistence and migration

**Files:**
- Modify: `backend/src/modules/contract/contract.schema.ts`
- Create: next Drizzle migration under `backend/drizzle/`
- Modify: `backend/src/db/test-db.ts`
- Test: `backend/src/test/schema-constraints.test.ts`

- [ ] Add `otpHash`, `otpExpiresAt`, and `otpAttempts` fields with safe defaults/nullability; generate migration and include table reset coverage.
- [ ] Add constraint tests for OTP attempt bounds and existing contract invariants.
- [ ] Run `cd backend && bun run typecheck && bun test src/test/schema-constraints.test.ts`.

### Task 2: Template service and manager template routes

**Files:**
- Create/modify: `backend/src/modules/contract/contract.types.ts`, `contract.service.ts`, `contract.route.ts`
- Modify: `backend/src/app.ts`
- Create: `backend/src/test/contract-template.test.ts`

- [ ] Implement list/create/get/update/delete template functions scoped by manager-owned motel.
- [ ] Validate non-empty names and clause `{title, content}` rows; atomically clear prior default when assigning a new default.
- [ ] Expose documented manager routes with 404 tenancy and 409 referenced-template deletion behavior.
- [ ] Run explicit template tests sequentially.

### Task 3: Manager contract lifecycle

**Files:**
- Modify: `contract.types.ts`, `contract.service.ts`, `contract.route.ts`
- Create: `backend/src/test/contract.test.ts`
- Modify: `docs/api-contract.md`, `docs/frontend-ui-specs.md`

- [ ] Implement create/list/detail/draft patch/send/terminate routes.
- [ ] Validate renter, room, template, and motel ownership; snapshot clauses and default monthly rent.
- [ ] Enforce draft-only edits, active-room conflict, and termination behavior.
- [ ] Keep send behind notification seam; successful send stamps `otpSentAt` only when delivery succeeds.
- [ ] Run contract tests plus room/renter regression tests.

### Task 4: Renter OTP signing

**Files:**
- Modify: `contract.service.ts`, `contract.route.ts`, `backend/src/app.ts`
- Create: `backend/src/test/contract-signing.test.ts`
- Modify: `docs/api-contract.md`, `docs/testing-strategy.md`

- [ ] Implement renter contract read, sign-request, and verify endpoints using renter session identity only.
- [ ] Generate six-digit OTP, hash with `Bun.password`, expire after five minutes, enforce five-minute resend cooldown and max three failed attempts.
- [ ] Verify atomically; stamp signing time and activate contract only on valid OTP.
- [ ] Return existing error envelope codes without leaking OTP/provider details.
- [ ] Run signing tests sequentially.

### Task 5: Full verification, review, commit, push

- [ ] Run backend typecheck and affected tests one at a time; run frontend typecheck/lint/build/tests.
- [ ] Run security and code review on uncommitted diff; resolve high findings.
- [ ] Run `git diff --check`, inspect status/diff/log.
- [ ] Commit with project-style message and push branch to `origin`.
