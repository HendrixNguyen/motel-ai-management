# Motel Management Full UI + API Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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

- [ ] Define Nhà Số Gọn voice, logo usage, colors, wordmark, tagline placement, and light/dark variants in `docs/brand-guidelines.md`.
- [ ] Create geometric house + digital signal logo as SVG icon + wordmark; no raster dependency, no emoji, no gradients required for recognition.
- [ ] Wire metadata, favicon, login/landing tagline, manager shell wordmark, and portal header without changing API behavior.
- [ ] Validate assets at 16px, 32px, 180px, 512px and against dark/light backgrounds; preserve visible focus and accessible labels.

### Task 2: API inventory and integration contract map

**Files:**
- Inspect/modify: `frontend/src/lib/api/*.ts`, `frontend/src/lib/api/types.ts`, `frontend/src/lib/api/client.ts`
- Test: API client tests

- [ ] Map every backend route to existing or missing frontend API functions: auth, motels, rooms, renters, billing/readings/photos, contracts/templates, renter portal, tickets, magic links, notifications.
- [ ] Add typed request/response functions only where backend route and schema exist.
- [ ] Centralize error decoding without leaking driver/provider details; preserve `details.server`, `skippedRooms`, and `retryAfterSeconds` where allowed.
- [ ] Add tests for JSON, multipart photo upload, 204 responses, 401 redirect behavior, and structured 409 errors.

### Task 3: shadcn/Radix primitives and design tokens

**Files:**
- Modify: `frontend/package.json`, `frontend/bun.lock`, `frontend/src/app/globals.css`
- Create/modify: `frontend/src/components/ui/`
- Test: `frontend/src/components/ui/__tests__/`

- [ ] Add only required Radix dependencies and source primitives; do not duplicate existing Button/Field/Badge contracts.
- [ ] Map Stitch palette/hierarchy to existing semantic tokens; change token values only after contrast review.
- [ ] Cover Dialog/Drawer focus trap/restoration, Escape, Select/Popover keyboard behavior, Toast announcements, pending state, and reduced motion.

### Task 4: Manager shell and navigation completion

**Files:**
- Modify: `frontend/src/app/(manager)/layout.tsx`, `frontend/src/components/manager/sidebar.tsx`, `top-bar.tsx`, navigation components
- Create/modify: manager secondary menu, notification inbox/menu components
- Test: shell tests and Playwright

- [ ] Implement Stitch shell: 240px desktop sidebar, compact mobile navigation, motel selector, manager menu, notification affordance.
- [ ] Add nav entries only for screens with implemented API or explicit unavailable screen.
- [ ] Preserve auth guard, selected motel URL state, skip link, safe area, and long-label behavior.

### Task 5: Overview, motels, rooms, renters

**Files:**
- Modify: manager `/`, `/motels`, `/rooms`, `/renters`, renter detail pages and existing manager components
- Test: route/component tests and mobile Playwright

- [ ] Polish Stitch M1/M2 room grid, occupancy, actionable tasks, motel cards, room status, renter cards/table, edit dialogs, magic links.
- [ ] Integrate current motel/room/renter APIs; preserve URL filters, partial PATCH baselines, phone normalization, and empty/error states.
- [ ] Never show zero metrics for failed reads; show actual unavailable/retry state.

### Task 6: Billing, invoice details, QR, payment evidence

**Files:**
- Modify: manager billing routes/components and renter bill routes/components
- Modify/create: invoice breakdown, QR card, payment status/evidence UI
- Test: billing and renter invoice tests

- [ ] Integrate periods, readings, invoice generation/list, finalize/send, paid/overdue transitions, and QR payload already exposed by backend.
- [ ] Render itemized arithmetic: rent, electricity, water, other fees, usage, unit prices, total, status, timestamps.
- [ ] Integrate payment-proof upload/review only if corresponding backend route exists; never mark paid from an image alone.
- [ ] Handle draft/sent immutability, skipped rooms, stale reading conflicts, and manual payment confirmation.

### Task 7: Meter capture PWA and meter photo upload

**Files:**
- Modify: manager capture pages and `capture-reading-client.tsx`
- Modify: `frontend/src/lib/api/capture.client.ts` and billing API module
- Test: capture unit/API tests and mobile Playwright

- [ ] Implement Stitch M5 one-handed sequential flow with previous/current reading, progress, save-next, sync/conflict/read-only state.
- [ ] Integrate existing atomic readings endpoint and meter photo multipart upload/signed-read endpoints.
- [ ] Keep queue namespaced by manager+motel and block stale queues after logout/motel switch.
- [ ] Test offline queue, upload failure/retry, invalid MIME/size response, `READING_CONFLICT`, and `PERIOD_ALREADY_SENT`.

### Task 8: Manager contract management and templates

**Files:**
- Create/modify: manager contract routes/components under `frontend/src/app/(manager)/contracts/`
- Modify/create: `frontend/src/lib/api/contracts*.ts`, contract forms, status badges, clause editor/viewer
- Test: contract API/component/Playwright tests

- [ ] Integrate contract list/create/detail/PATCH draft/send/terminate and template endpoints present in backend/API contract.
- [ ] Match Stitch R4/M2 detail hierarchy: renter, room, dates, rent, deposit, clause snapshot, draft/active/expired/terminated status.
- [ ] Disable draft editing after activation/termination; require destructive termination confirmation.
- [ ] Render notification failure as actionable form-level error without fake sent timestamp.

### Task 9: Renter portal contract OTP, bills, tickets, and magic-link exchange

**Files:**
- Modify: `frontend/src/app/portal/*`, `frontend/src/app/renter/*`, `frontend/src/app/r/*`
- Modify renter components and create missing portal API modules
- Test: renter API/component/Playwright tests

- [ ] Match Stitch R1/R2/R3/R4/R5 mobile portal: sticky header, invoice arithmetic, QR, contract signing, ticket creation, upload states.
- [ ] Integrate renter contract GET/sign-request/verify with six-digit OTP UX, cooldown/rate limit, invalid/expired states, and no OTP leakage.
- [ ] Integrate magic-link exchange/logout and preserve 24-hour session behavior.
- [ ] Integrate renter invoice/ticket reads and mutations; keep missing room, empty history, upload failure, and unauthorized states explicit.

### Task 10: Tickets, notifications, reports, and settings

**Status note (2026-10-09):** Deferred as separate BE + FE delivery. Backend must first expose manager ticket list/detail/status mutations, notification inbox/history and resend, report data endpoints, and motel settings PATCH coverage. Frontend then adds manager tickets, notifications, reports, and settings routes using only those real contracts; unavailable metrics stay explicit and no fake records are rendered. Renter ticket endpoints already exist and are handled in Task 9.

**Files:**
- Create/modify: manager tickets, reports, settings routes/components
- Modify: notification API/UI and motel settings forms
- Test: route/API/component tests

- [ ] **BE:** Add manager ticket endpoints under `/api/manager/motels/:motelId/tickets`: list with `status`/`category` filters, detail with renter phone and photos, PATCH status/manager note, tenant 404, resolved timestamp, notification outbox semantics.
- [ ] **BE:** Add manager notification endpoints under `/api/manager/motels/:motelId/notifications`: GET delivery history and POST resend; redact provider/storage details and preserve failure reason contract.
- [ ] **BE:** Add report read endpoints only for metrics backed by existing tables/calculations; define exact response schemas and tenant scoping. Leave unsupported metrics absent rather than inventing data.
- [ ] **BE:** Confirm/extend motel settings PATCH contract for pricing, other fees, bank account, and configuration validation; add API contract, service, HTTP isolation, and constraint tests.
- [ ] **FE:** Add typed API modules for manager tickets, notifications, reports, and settings only after backend routes land; map 401/404/409/502 errors through shared client.
- [ ] **FE:** Build manager tickets list/detail/status actions, notification inbox/resend states, reports unavailable states, and motel settings forms using real responses only.
- [ ] **FE:** Add route/component/API tests for filters, status mutation, resend failure, unavailable metrics, partial PATCH baseline, tenant errors, loading/empty/error states, and mobile layout.

### Task 11: Documentation and contract synchronization

**Files:**
- Modify: `docs/frontend-ui-specs.md`
- Modify: `docs/testing-strategy.md`
- Add: `docs/superpowers/specs/2026-10-09-core-ui-v2-design.md`
- Add: `docs/superpowers/plans/2026-10-09-core-ui-v2.md`
- Test: documentation drift checklist and links/path validation

- [ ] Document Core UI v2 primitives, compatibility rules, light/dark/system theme behavior, responsive breakpoints, focus/safe-area rules, and domain-composition boundary in `docs/frontend-ui-specs.md`.
- [ ] Document primitive test ownership, required interaction/accessibility coverage, viewport matrix (`360`, `375`, `430`, `1280`), Bun commands, and Playwright environment blockers in `docs/testing-strategy.md`.
- [ ] Include the approved Core UI v2 spec and implementation plan in the same delivery; remove no existing product requirements.
- [ ] Check every changed UI behavior against its owning document; record intentional out-of-scope backend/API work instead of documenting nonexistent endpoints.
- [ ] Verify all referenced paths, commands, and test counts are current before commit.

### Task 12: Shared states, visual QA, and regression verification

**Files:**
- Modify: shared UI and tests only for verified defects

- [ ] Standardize loading, empty, error, unavailable, conflict, pending, success, and destructive confirmation states across all surfaces.
- [ ] Run `cd frontend && bun run typecheck`.
- [ ] Run `cd frontend && bun run lint`.
- [ ] Run `cd frontend && bun run build`.
- [ ] Run `cd frontend && bun run test`.
- [ ] Run `cd frontend && bun run test:e2e`; report missing Chromium OS libraries if launch fails.
- [ ] Review screenshots at `360`, `375`, `430`, `1280` for overlap, clipping, overflow, hidden focus, contrast, and touch targets.
- [ ] Verify no auth, tenant isolation, API contract, money, upload, OTP, QR, or deferred-surface regression.
- [ ] Record coverage for every changed flow: API client unit tests, component interaction tests, route/server-state tests, and Playwright viewport coverage for user-facing flows.
- [ ] Report test commands, pass/fail counts, skipped tests with reasons, and environment blockers in the implementation handoff.
