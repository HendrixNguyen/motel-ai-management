# Manager UI Redesign Implementation Plan

> **Execution status:** Complete; implementation committed as `3c9588f` and pushed to `feat/manager-ui-redesign-implementation`. PR #21 targets `feat/manager-ui-redesign`.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign every supported Manager screen in Quiet Ledger style while preserving existing workflows, API behavior, and accessible mobile/desktop operation.

**Architecture:** Retain Next.js App Router, existing Tailwind tokens, UI primitives, server-side API clients, and page/domain boundaries. Refactor only shared shell and small presentation primitives, then migrate screen groups by isolated routes; independent screen-group tasks can run in parallel after shared foundation is stable and do not own shared-shell files.

**Tech Stack:** Bun, Next.js 16.3.8, React, Tailwind CSS, Vitest, Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-19-manager-ui-redesign-design.md`

## Global Constraints

- Preserve documented behavior, routes, API semantics, motel scope, form guarantees, and Vietnamese user-facing text.
- Keep Quiet Ledger tokens: canvas `#F3F6F8`, surface `#FFFFFF`, ink `#172B3A`, primary `#087E8B`, accent `#E9B949`; use semantic tokens, not per-screen hex values.
- Manager mobile navigation has at most five primary destinations; every supported destination remains discoverable.
- Support 360px–1440px with no page-level horizontal overflow; touch targets minimum 44×44px; keyboard focus visible; normal-text contrast at least 4.5:1; reduced motion respected.
- Never invent API data/routes or show ticket administration, unsupported analytics, or unsupported due dates. Use same-origin relative `/api` only.
- Money uses existing BigInt-safe VND helpers; never convert VND to floating point.
- CCCD uploads/previews remain manager-only; renter payment-proof cap remains 5,000,000 bytes; preserve sensitive object URL handling.
- No backend/schema changes, new dependencies, QA mutations, deployments, or commits unless the user separately authorizes them. Each subagent must not create more subagents.
- Tests must prove interactions and resulting states, not only snapshots/classes. Inspect and record test coverage at completion.

## Review Focus

- Long Vietnamese labels, room/renter names, and formatted VND amounts at 360px; verify readable wrapping/truncation rules without clipping or horizontal overflow in screen-group browser tests.
- Motel switching while filters or capture queue state exist; verify route/filter preservation and queue warning behavior in shell interaction tests.
- No motel, no rooms, no current billing period, empty invoices, and failed reads; keep distinct and never render unsupported zero metrics in dashboard tests.
- Billing and payment pending/conflict states; preserve authoritative API status, duplicate-submit prevention, and private proof display in billing interaction tests.
- Capture offline, stale conflict, sent period, and photo states; preserve focused phone workflow in capture E2E tests.

---

## File Map

- `frontend/src/app/globals.css`: existing design tokens and global responsive/focus behavior; modify only for token gaps verified by tests.
- `frontend/src/components/manager/sidebar.tsx`, `navigation-link.tsx`, `top-bar.tsx`, `frontend/src/components/ui/manager-shell.tsx`, `bottom-nav.tsx`: shared shell/nav; Task 2 owns these files.
- `frontend/src/components/ui/`: existing reusable primitives. Task 1 adds/refines only minimal presentation primitives needed by the mockup; no page/domain fetching.
- `frontend/src/app/(manager)/page.tsx` and adjacent overview components/tests: dashboard; Task 3 only.
- `frontend/src/app/(manager)/capture/**`, `frontend/src/components/manager/capture-*.tsx`: capture list/period workflow; Task 4 only. Room capture route behavior and service worker logic are preserved.
- `frontend/src/app/(manager)/billing/**`, `frontend/src/components/manager/billing-*.tsx`, relevant billing tests: billing/invoice/payment UI; Task 5 only.
- `frontend/src/app/(manager)/motels/**`, `rooms/**`, `renters/**`, `contracts/**`, matching `frontend/src/components/manager/` components and tests: existing CRUD/detail screens; Task 6 owns these paths and does not edit shared shell/primitives.
- `docs/frontend-ui-specs.md`: update only durable visual/nav facts verified after the screen work; Task 7 owns docs and final regression evidence.
- `frontend/e2e/**`: targeted responsive/interaction specs, organized with the owning task; avoid parallel edits to an existing E2E file by assigning exact file ownership before dispatch.

## Parallel Execution Boundaries

Use one setup/foundation task first. After it passes review, Tasks 2–6 can be dispatched as independent subagent worktrees in parallel, each with exclusive file ownership listed above. Dashboard and shell do not share source files after Task 1; capture, billing, and CRUD screen groups do not share source files with each other. Task 7 starts only after all screen tasks pass their scoped reviews, then whole-app validation/review runs serially. If actual code inspection reveals shared file ownership, split/sequence those edits rather than allowing conflicting parallel writes.

### Task 1: Shared design foundation

**Files:**
- Read/modify: `frontend/src/app/globals.css` only if a missing semantic token or responsive global rule is verified
- Create/modify: minimal presentation primitives in `frontend/src/components/ui/` (exact component name selected after checking existing primitives)
- Test: colocated tests under `frontend/src/components/ui/__tests__/`
- Read: relevant installed Next.js docs under `frontend/node_modules/next/dist/docs/` before Next code changes

**Interfaces:**
- Consumes: existing Quiet Ledger tokens and UI component contracts in `docs/frontend-ui-specs.md`.
- Produces: only small presentational pieces necessary for shared measure/ledger/page-action visual hierarchy; existing primitive callers remain source-compatible.

- [x] Inspect existing tokens/primitives and write tests for any new component behavior and responsive content requirements.
- [x] Run exact Vitest test file and verify new assertions fail before implementation.
- [x] Implement the smallest reusable primitive/token correction; no fetching, domain logic, abstractions for one consumer, or new dependency.
- [x] Run exact Vitest tests, then `cd frontend && bun run typecheck && bun run lint`.
- [x] Commit only intended files if commit is authorized by the execution harness/owner; otherwise leave changes uncommitted and report.

### Task 2: Manager shell and navigation

**Files:**
- Modify: `frontend/src/components/manager/sidebar.tsx`
- Modify: `frontend/src/components/manager/navigation-link.tsx`
- Modify: `frontend/src/components/manager/top-bar.tsx`
- Modify: `frontend/src/components/ui/manager-shell.tsx`
- Modify: `frontend/src/components/ui/bottom-nav.tsx`
- Test: existing shell/navigation/switcher tests and a dedicated shell E2E file if no suitable one exists

**Interfaces:**
- Consumes: Task 1 presentation primitives; existing `Sidebar`, `TopBar`, `ManagerShell`, `BottomNav`, and `MotelSwitcher` contracts.
- Produces: responsive shell with desktop sticky navy sidebar, mobile compact header and no more than five primary destinations, labelled secondary route menu, preserved motel selector, capture warning, theme/account/logout behavior.

- [x] Add failing tests for active route labels, five-or-fewer mobile primary destinations, access to all supported destinations, keyboard menu interaction, motel switching retaining path/query, and capture warning visibility.
- [x] Run exact Vitest/Playwright tests and observe failures.
- [x] Implement shell/nav within listed files; use real installed icon assets/conventions, no numeric text icons or emoji.
- [x] Run exact tests and responsive geometry checks at 360, 375, 430, 640, 768, 1024, 1440px; assert document scroll width does not exceed viewport width.
- [x] Run `cd frontend && bun run typecheck && bun run lint`.
- [x] Commit intended changes only if authorized.

### Task 3: Overview dashboard

**Files:**
- Modify: `frontend/src/app/(manager)/page.tsx`
- Add/modify dashboard-only component(s) under `frontend/src/components/manager/`
- Add/modify dashboard-only unit and E2E tests

**Interfaces:**
- Consumes: Task 1 visual primitives, Task 2 shell, existing room/renter/billing/motel APIs and `motelHref`.
- Produces: Quiet Ledger overview with grouped room metrics, defensible current-period invoice totals, invoice ledger, quick actions, selected motel context, and distinct empty/error states.

- [x] Add failing tests for valid room/occupancy math; no motel, empty rooms, no period/invoices, failed reads; unpaid count/amount; no unsupported ticket metric; and correct selected-motel quick-action URLs.
- [x] Run exact tests and observe failures.
- [x] Implement dashboard using existing API data only. Derive unpaid amounts with existing money helpers; omit uncertain revenue estimate and ticket panel unless verified API support exists.
- [x] Run exact unit and fixture E2E tests; inspect 360, 375, 640, 768, 1024, 1440px for clipping and row readability.
- [x] Run `cd frontend && bun run typecheck && bun run lint`.
- [x] Commit intended changes only if authorized.

### Task 4: Meter capture entry and period overview

**Files:**
- Modify: `frontend/src/app/(manager)/capture/page.tsx`
- Modify: `frontend/src/app/(manager)/capture/[periodId]/page.tsx`
- Modify: capture-list/period components and colocated tests only
- Do not modify: `capture/[periodId]/room/[readingId]` logic, sync service, service worker, offline queue implementation

**Interfaces:**
- Consumes: Task 1 presentation primitives and Task 2 shell; existing capture API/client/sync interfaces.
- Produces: Quiet Ledger capture entry/period overview, preserving existing route and PWA focused room entry.

- [x] Add failing browser tests for period selection, room progress/state, draft versus sent behavior, offline queue summary, and mobile one-handed action layout.
- [x] Run exact E2E and observe failures.
- [x] Restyle entry/period surfaces only; preserve sync, validation, upload and state transitions. One period-wide completion guard correction was added after review found it could allow completion with another room's missing meter.
- [x] Run capture unit/E2E tests and geometry checks 360–768px; verify focused room route remains free of added desktop chrome and no regressions in conflict/offline/upload behavior.
- [x] Run `cd frontend && bun run typecheck && bun run lint`.
- [x] Commit intended changes only if authorized.

### Task 5: Billing, invoices, QR and payment review

**Files:**
- Modify: `frontend/src/app/(manager)/billing/**`
- Modify: billing-only components under `frontend/src/components/manager/`
- Modify: billing tests and billing-owned E2E spec only
- Do not modify: backend routes/schema, renter portal, shared shell/primitives

**Interfaces:**
- Consumes: Task 1 presentation primitives and Task 2 shell; current billing and payment endpoints.
- Produces: consistent period/invoice ledger hierarchy and clear detail/payment states with exact existing operations.

- [x] Add failing tests for exact VND rendering, invoice statuses, QR/detail visibility, approve/reject/cash distinct actions, pending duplicate prevention, conflict refresh, no renter payment mutation, and private proof URLs not leaked to href/log text.
- [x] Run exact tests and observe failures.
- [x] Apply visual redesign while preserving server-authoritative transitions and proof privacy.
- [x] Run targeted Vitest/fixture E2E; geometry checks at 360, 375, 430, 640, 768, 1024, 1440px.
- [x] Run `cd frontend && bun run typecheck && bun run lint`.
- [x] Commit intended changes only if authorized.

### Task 6: Motels, rooms, renters, contracts

**Files:**
- Modify existing routes under `frontend/src/app/(manager)/motels/**`, `rooms/**`, `renters/**`, `contracts/**`
- Modify only matching route-owned components/tests under `frontend/src/components/manager/`
- Modify route-group-specific E2E specs only; do not edit shell/primitives/dashboard/capture/billing files

**Interfaces:**
- Consumes: Task 1 presentation primitives and Task 2 shell; existing page/API/form contracts.
- Produces: Quiet Ledger presentation across current motels, room, renter, and contract functions without new capabilities or fields.

- [x] Add or update failing behavior tests for filter/query preservation, form patch semantics, conflict/error draft retention, dialog focus return, manager-only CCCD, upload control reachability, contract state labels, and mobile table/card reflow.
- [x] Run exact tests and observe failures.
- [x] Restyle only; preserve existing CRUD, validations, APIs, security, and error semantics.
- [x] Run route-owned Vitest/fixture E2E and responsive geometry checks at 360, 375, 430, 640, 768, 1024, 1440px.
- [x] Run `cd frontend && bun run typecheck && bun run lint`.
- [x] Commit intended changes only if authorized.

### Task 7: Documentation and whole-UI validation

**Files:**
- Modify: `docs/frontend-ui-specs.md` only for verified durable changes
- Modify/add: final responsive/real-stack regression tests only if existing coverage cannot assert acceptance criteria
- Inspect: frontend test coverage and current git diff

**Interfaces:**
- Consumes: reviewed outputs of Tasks 1–6.
- Produces: accurate UI documentation and final evidence for all acceptance criteria.

- [x] Update navigation/shell/dashboard visual notes and clarify deferred unsupported metrics only where implementation verified.
- [x] Run full frontend verification in order: `bun run typecheck`, `bun run lint`, `bun run build`, `bun run test`, `bun run test:e2e` from `frontend/`.
- [x] Run real-stack manager E2E only with explicitly configured safe QA target; no safe QA target was configured, so real-stack E2E was not run. No QA/prod mutations or deployments.
- [x] Test viewport geometry and keyboard/action outcomes across 360, 375, 430, 640, 768, 1024, 1440px; fixture E2E passed. Console/network errors and screenshots were not separately archived; expected fixture-injected server errors were checked for safe UI handling.
- [x] Inspect and record test coverage; no OS browser dependency blocker. Coverage: 91.19% statements, 95.71% lines, 86.94% functions, 86.05% branches. Full suite: typecheck/lint/build pass, 613 unit tests and 105 E2E tests pass.
- [x] Run final review against spec, `docs/frontend-ui-specs.md`, test output, and `git diff`; resolved material findings before declaring done.
- [x] Commit intended changes only if authorized. Implementation commit: `3c9588f`; branch pushed; PR #21 opened.

### Execution record

- All seven tasks complete; implementation and whole-branch review complete.
- Original implementation checks: typecheck, lint, build, 613 unit tests, and 105 fixture E2E tests passed. Review-fix checks: typecheck/lint/build passed, 618 unit tests and 105 E2E tests passed.
- Latest coverage: statements 91.16%, lines 95.72%, functions 86.94%, branches 86.16%.
- Real-stack QA E2E not run because no safe QA target was configured. No QA/production changes or deployments.
- `docs/frontend-ui-specs.md` records verified navigation and capture limitations. Capture list API has no per-period progress or offline queue summary; UI does not fabricate either.
- Implementation commit `3c9588f` pushed; PR #21 open against `feat/manager-ui-redesign`.

---

## Review checklist by task

- Task 1: token drift, duplicate primitive, public-prop compatibility, no unnecessary dependencies.
- Task 2: destination discoverability, accessible secondary menu, max-five mobile nav, sticky/fixed geometry, query preservation, capture warning.
- Task 3: metric math, unsupported/empty data, VND exactness, motel-safe links, no fake ticket content.
- Task 4: offline/conflict/sent workflow unchanged, camera-independent entry, one-handed phone geometry.
- Task 5: payment transition correctness, duplicate actions, proof privacy, QR/formatted money behavior.
- Task 6: route-scoped state, forms/CCCD/contracts security and semantics, narrow viewport reflow.
- Task 7: doc/API drift, full test order, visual overflow, keyboard and real-stack coverage, coverage evidence.
