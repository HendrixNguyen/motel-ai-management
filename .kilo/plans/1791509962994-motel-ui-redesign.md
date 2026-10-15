# Motel Management Full UI + API Integration Plan

> **Status (2026-10-13):** Reconciled against the `qa` worktree. Tasks 1–7 and renter-portal portions of Task 9 are implemented to varying degrees; see task status notes below. Task 8 is partial. Task 10 manager-side BE/FE work is not implemented. Task 11 is partial. Task 12 has frontend validation evidence but not a complete coverage/visual QA record. Checklist marks mean repository evidence exists, not that every product vision item in the task is fulfilled.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Current implementation branch:** `qa` (2026-10-13). Do not infer current implementation from the earlier PR branch/merge handoff; use current `qa` code as source of truth.

**Active future direction:** `.kilo/plans/1791607963547-frontend-ui-ux-rebuild-plan.md` supersedes broad visual-rebuild assumptions and is planning-only. It has not authorized implementation. Keep this legacy plan as a delivery/status record; do not use it to imply the newer rebuild plan was executed.

**Goal:** Complete the Stitch-referenced Vietnamese motel product UI across manager, capture PWA, renter portal, billing, contracts, tickets, reports, settings, QR, meter photos, and notifications, integrating every backend endpoint already present while never inventing data for endpoints that do not exist.

**Brand:** Product display name is **Nhà Số Gọn**; technical slug is `nha-so-gon`. Use icon + wordmark in app shell and favicon/app icon contexts. Use tagline **Quản lý nhà trọ gọn hơn mỗi ngày** only on login/landing surfaces, never in compact navigation.

**Architecture:** Preserve current Next.js route groups and domain API modules. Add shadcn/Radix primitives as an internal accessible layer, then compose screen-specific UI from existing domain components. Extend `frontend/src/lib/api/` only from `docs/api-contract.md` and backend route schemas; keep tenant/session/money/error semantics unchanged.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind CSS v4, shadcn/ui source primitives, Radix UI, Bun, Vitest, Playwright.

**Spec:** `docs/frontend-ui-specs.md`, `docs/api-contract.md`, backend route modules under `backend/src/modules/`, Stitch project `3036971879990930028`.

## Global Constraints

- Brand source of truth: `Nhà Số Gọn`, slug `nha-so-gon`, icon + wordmark; tagline only on login/landing.
- Create and document logo assets before shell polish; validate favicon, light/dark, 16px, 32px, 180px, and 512px contexts.
- Browser uses same-origin relative `/api`; never expose `BACKEND_URL` or secrets.
- Use Vietnamese copy, current session cookies, tenant scoping, `{error, code, details?}` handling, and VND digit-string transport.
- Integrate existing backend endpoints before adding UI; no fake totals, invoices, contracts, tickets, notification results, or payment states.
- Add shadcn/Radix only for Dialog, Drawer, DropdownMenu, Select, Popover, Tabs, Tooltip, Toast, Command and equivalent accessible primitives.
- Preserve 44x44px touch targets, visible focus, reduced motion, keyboard access, safe areas, and no horizontal scroll at `360px`.
- Validate `360`, `375`, `430`, and `1280` widths.
- Keep API/domain components separate from generic UI primitives.

## Review Focus

- API errors map correctly: `401`, `404`, `409`, `READING_CONFLICT`, `PERIOD_ALREADY_SENT`, `OTP_INVALID`, `OTP_EXPIRED`, `RATE_LIMITED`, and `EXTERNAL_SERVICE_ERROR`.
- Cross-motel IDs never render or mutate through manager screens; renter session never reaches manager APIs.
- Money and meter values stay exact strings/decimal-safe values; no floating-point UI calculations.
- Mobile forms, drawers, file/photo upload, QR, and sticky actions remain usable with keyboard and narrow widths.
- Screens for genuinely absent endpoints say unavailable and never fabricate records or metrics.

---

### Task 1: Brand identity and asset contract

**Files:**
- Create: `docs/brand-guidelines.md`
- Create: `frontend/public/brand/logo.svg`, `frontend/public/brand/logo-mark.svg`, `frontend/public/favicon.svg`
- Modify: `frontend/src/app/layout.tsx`, `frontend/src/app/globals.css`
- Test: asset validation and metadata/alt-text checks

- [x] Define Nhà Số Gọn voice, logo usage, colors, wordmark, tagline placement, and light/dark variants in `docs/brand-guidelines.md`.
- [x] Create geometric house + digital signal logo as SVG icon + wordmark; no raster dependency, no emoji, no gradients required for recognition.
- [x] Wire metadata, favicon, login/landing tagline, manager shell wordmark, and portal header without changing API behavior.
- [ ] Validate assets at 16px, 32px, 180px, 512px and against dark/light backgrounds; preserve visible focus and accessible labels. (Asset contexts are declared in guidelines; screenshot/size QA evidence not found.)

**Status:** Implemented; asset-size visual validation remains unverified.

### Task 2: API inventory and integration contract map

**Files:**
- Inspect/modify: `frontend/src/lib/api/*.ts`, `frontend/src/lib/api/types.ts`, `frontend/src/lib/api/client.ts`
- Test: API client tests

- [x] Map the shipped manager/renter API integrations to backend routes and schemas for auth, motels, rooms, renters, billing/readings/photos, contracts/templates, renter portal, tickets, magic links and payment proofs. Full notification/admin-route inventory is incomplete because those manager endpoints do not exist.
- [x] Add typed request/response functions for implemented backend routes.
- [x] Centralize error decoding without leaking driver/provider details; preserve supported details such as `skippedRooms` and retry information where exposed.
- [x] Add API client tests covering JSON, multipart, 204, 401/session behavior and structured conflicts.

**Status:** Implemented for existing endpoints; manager notification/report/ticket APIs remain intentionally absent.

### Task 3: shadcn/Radix primitives and design tokens

**Files:**
- Modify: `frontend/package.json`, `frontend/bun.lock`, `frontend/src/app/globals.css`
- Create/modify: `frontend/src/components/ui/`
- Test: `frontend/src/components/ui/__tests__/`

- [x] Add required primitives and source components while retaining existing Button/Field/Badge APIs; current kit is custom/native-dialog based rather than a wholesale Radix migration.
- [x] Map the shipped visual hierarchy to semantic tokens.
- [x] Cover dialog/drawer focus, Escape, toast announcements, pending states and reduced motion with unit/E2E checks. Select/Popover parity is only applicable where those primitives are used; not every primitive in the original vision was added.

**Status:** Core UI v2 substantially implemented; newer plan's OS-system default/hydration refinements remain unimplemented and must not be assumed complete.

### Task 4: Manager shell and navigation completion

**Files:**
- Modify: `frontend/src/app/(manager)/layout.tsx`, `frontend/src/components/manager/sidebar.tsx`, `top-bar.tsx`, navigation components
- Create/modify: manager secondary menu, notification inbox/menu components
- Test: shell tests and Playwright

- [x] Implement manager shell: 240px desktop sidebar, compact mobile navigation, motel selector and secondary manager menu.
- [x] Keep navigation focused on implemented screens; no manager ticket/report/settings destinations were added without APIs.
- [x] Preserve auth guard, selected motel URL state, skip link and safe-area behavior.

**Status:** Implemented and desktop sidebar overlap regression fixed; notification inbox affordance remains unavailable because manager notification read APIs are absent.

### Task 5: Overview, motels, rooms, renters

**Files:**
- Modify: manager `/`, `/motels`, `/rooms`, `/renters`, renter detail pages and existing manager components
- Test: route/component tests and mobile Playwright

- [x] Implement manager overview, motel cards, room list/status, renter list/detail, edit dialogs and magic-link action using live API data.
- [x] Integrate motel/room/renter APIs; preserve URL filters, partial PATCH baselines, phone normalization, and empty/error states.
- [x] Failed reads render error/retry states rather than fabricated zero metrics.

**Status:** Shipped behavior exists; exact Stitch M1/M2 visual parity is not verified and belongs to the newer planning-only rebuild/visual approval gate.

### Task 6: Billing, invoice details, QR, payment evidence

**Files:**
- Modify: manager billing routes/components and renter bill routes/components
- Modify/create: invoice breakdown, QR card, payment status/evidence UI
- Test: billing and renter invoice tests

- [x] Integrate periods, readings, invoice generation/list, finalize/send, paid/overdue transitions, and QR payload already exposed by backend.
- [x] Render itemized arithmetic: rent, electricity, water, other fees, usage, unit prices, total, status and timestamps.
- [x] Integrate renter payment-proof upload and manager proof review using implemented backend routes; an image alone never marks an invoice paid.
- [x] Handle draft/sent immutability, skipped rooms, stale reading conflicts and manual cash confirmation.

**Status:** Backend and frontend payment-proof/cash-confirmation flows are implemented with dedicated tests and E2E coverage.

### Task 7: Meter capture PWA and meter photo upload

**Files:**
- Modify: manager capture pages and `capture-reading-client.tsx`
- Modify: `frontend/src/lib/api/capture.client.ts` and billing API module
- Test: capture unit/API tests and mobile Playwright

- [x] Implement sequential capture flow with previous/current reading, progress, save-next, sync/conflict/read-only states.
- [x] Integrate atomic readings endpoint and meter-photo multipart upload/signed-read endpoints.
- [x] Derive queue ownership from server-authenticated manager ID; guard enqueue by owner; filter sync by manager+motel+period; preserve offline data on motel switch, quarantine legacy `browser` rows, show a warning, and clear only after explicit user confirmation. Logout preserves per-account queue data for later login on the same browser.
- [x] Test queue manager scope, sync motel+period isolation, forged manager writes, offline reload/reconnect, stale server conflict and sent-period read-only behavior.
- [ ] Complete retry/partial-photo failure and invalid MIME/size matrix; no coverage evidence for every case found.

**Status:** Identity/scope/lifecycle safeguards implemented; full photo retry/invalid-type matrix, transaction-abort/quota tests and physical-device QA remain. Verified 2026-10-13 by frontend suite: 466 unit tests, 92 mobile Playwright tests, typecheck/build pass.

### Task 8: Manager contract management and templates

**Status: Implemented for existing APIs (reverified 2026-10-13).** Frontend list resolves motel-scoped renter/room names and shows deposit; create/edit draft, detail/clause snapshot, send request, active termination confirmation, and template create/update/delete are implemented with regression unit/E2E coverage. Contract E2E verifies create/edit/detail/terminate/template CRUD. Send status is described as a request/accepted status, not provider delivery; provider-dependent delivery remains gated separately.

**Files:**
- Create/modify: manager contract routes/components under `frontend/src/app/(manager)/contracts/`
- Modify/create: `frontend/src/lib/api/contracts*.ts`, contract forms, status badges, clause editor/viewer
- Test: contract API/component/Playwright tests

- [x] Integrate contract list/create/detail/PATCH draft/send/terminate and template endpoints that exist in backend/API contract.
- [x] Present renter, room, dates, rent, deposit, clause snapshot and existing status fields using motel-scoped reads.
- [x] Disable draft edits outside draft status; require destructive termination confirmation.
- [x] Keep send wording truthful to the existing request/status API; do not claim provider delivery.
- [ ] Notification failure/retry details remain unavailable until manager delivery-status/retry backend contract/provider gate is resolved.

### Task 9: Renter portal contract OTP, bills, tickets, and magic-link exchange

**Status: Implemented for currently exposed renter APIs.** Renter bill details/payment proof, contract OTP, magic-link exchange/logout, ticket list/create/detail and portal shell are present and covered by unit/E2E flows. Physical-device and external provider delivery remain unverified/gated.

**Files:**
- Modify: `frontend/src/app/portal/*`, `frontend/src/app/renter/*`, `frontend/src/app/r/*`
- Modify renter components and create missing portal API modules
- Test: renter API/component/Playwright tests

- [x] Implement mobile renter portal shell, itemized invoice arithmetic/QR, contract OTP signing, ticket creation and upload states.
- [x] Integrate renter contract GET/sign-request/verify with six-digit OTP UX, rate-limit/error states and no OTP leakage.
- [x] Integrate magic-link exchange/logout and existing session behavior.
- [x] Integrate renter invoice/ticket reads and mutations; represent empty history, upload failure and unauthorized states explicitly.
- [ ] Complete visual parity/screenshot and real-device validation for all R1–R5 states; fixture E2E is not device/provider proof.

### Task 10: Tickets, notifications, reports, and settings

**Status: Partial; manager tickets/reports UI/API intentionally excluded by newer approved rebuild scope.** Renter ticket API/UI exists. No manager ticket routes or report module/endpoints exist; newer plan §3 explicitly defers those surfaces. Notification module handles internal enqueue/delivery plumbing only; provider identity is unknown and no manager status/retry API exists. Existing motel PATCH covers prices, fees and bank account; dedicated settings route is not needed. Do not implement ticket/report screens or provider delivery without an approved scope change/provider decision.

**Files:**
- Create/modify: manager tickets, reports, settings routes/components
- Modify: notification API/UI and motel settings forms
- Test: route/API/component tests

- [ ] **BE:** Manager tickets list/detail/status/note endpoints — deferred by newer plan §3; no manager route exists. Requires explicit scope re-approval before implementation.
- [ ] **BE:** Notification history/resend — provider decision is unresolved; no manager status/retry contract. Keep queued/enqueued distinct from delivery; do not add fake counts or OA.
- [ ] **BE:** Reports — deferred/no verified reportable domain contract; do not create synthetic metrics.
- [x] **BE (existing scope):** Motel PATCH supports name/address/prices/otherFees/bankAccount with validation. No separate settings API required by the newer plan.
- [ ] **FE:** Manager ticket/report UI is intentionally out of the current rebuild scope. Notification delivery UI waits on provider/status API.
- [x] **FE (existing scope):** Motel editor exposes the supported pricing/fees/bank settings fields; no duplicated settings route.
- [ ] **Tests:** Add tests only when a deferred, approved manager API contract exists; preserve renter ticket and supported settings coverage.

### Task 11: Documentation and contract synchronization

**Status: Partial.** `docs/frontend-ui-specs.md` and `docs/testing-strategy.md` contain Core UI v2 guidance; Core UI v2 spec/plan files exist. Theme behavior and test totals need reconciliation against current `qa` code and the newer planning-only plan before this task can close.

**Files:**
- Modify: `docs/frontend-ui-specs.md`
- Modify: `docs/testing-strategy.md`
- Add: `docs/superpowers/specs/2026-10-09-core-ui-v2-design.md`
- Add: `docs/superpowers/plans/2026-10-09-core-ui-v2.md`
- Test: documentation drift checklist and links/path validation

- [x] Document Core UI v2 primitives, compatibility rules, theme behavior, responsive breakpoints, focus/safe-area rules, and domain-composition boundary in `docs/frontend-ui-specs.md`.
- [x] Document primitive test ownership, interaction/accessibility coverage, viewport matrix, Bun commands, and Playwright blockers in `docs/testing-strategy.md`.
- [x] Core UI v2 spec and implementation plan files exist in `docs/superpowers/`.
- [x] Reconcile theme defaults: current legacy UI defaults to Light unless explicit stored preference; newer rebuild plan requests System default. They are not equivalent; newer plan remains planning-only and must be selected/approved before implementation changes.
- [x] Re-verify current frontend commands and counts: 464 unit tests, 92 mobile E2E, typecheck/build pass; backend typecheck passes. Backend integration suite still requires `MIGRATION_TEST_ADMIN_URL`.
- [ ] Capture/review viewport screenshots and coverage report before claiming full visual QA.

### Task 12: Shared states, visual QA, and regression verification

**Status: Partial (rechecked 2026-10-13).** Frontend typecheck/build pass; lint has one unused-import warning in `e2e/invoice-payment-review.spec.ts`; 466 unit tests and 92/92 mobile E2E pass. Backend typecheck passes, but full backend tests stop at migration integration-test guard because `MIGRATION_TEST_ADMIN_URL` is not configured for disposable PostgreSQL. Desktop sidebar has targeted geometry E2E; full screenshot matrix, physical-device QA and coverage report remain unverified.

**Files:**
- Modify: shared UI and tests only for verified defects

- [x] Shared loading, empty, error, unavailable, conflict, pending, success and confirmation components/states exist across many shipped screens; full cross-surface consistency not proven.
- [x] Frontend typecheck passed on current `qa` state (2026-10-13).
- [x] Frontend lint passed with one pre-existing unused import warning in `e2e/invoice-payment-review.spec.ts`.
- [x] Frontend production build passed on current `qa` state.
- [x] Frontend unit suite: 54 files, 466 tests passed.
- [x] Mobile Playwright suite: 92/92 passed; contract CRUD and capture queue delivery flows included.
- [x] Backend typecheck passed. Full backend test suite blocked by missing `MIGRATION_TEST_ADMIN_URL` for disposable PostgreSQL integration tests; not counted as pass.
- [ ] Capture/review screenshots at `360`, `375`, `430`, `1280` for overlap, clipping, overflow, hidden focus, contrast, and touch targets on the current QA build.
- [ ] Backend auth/tenant/API/money/upload/OTP integration tests need rerun once disposable `MIGRATION_TEST_ADMIN_URL` is available. Frontend auth/tenant/payment-proof/OTP/QR/capture E2E passed (92/92); manager notification/report surfaces remain deferred.
- [ ] Record coverage for each changed flow; no verified coverage report for current state found.
- [ ] Publish a final handoff with current commands/results, skipped checks, and blockers.
