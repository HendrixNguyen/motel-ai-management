# Whole-App UI Defect Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix browser-confirmed manager shell geometry, dark theme surfaces, and menu dismissal, then audit all app routes in browser for remaining visible defects.

**Architecture:** Keep changes within existing Next.js UI shell, CSS tokens, controls and route-specific components. Diagnose and reproduce each defect using authenticated Playwright browser before edits; add focused regressions; make minimal shared-component fixes without changing API behavior, workflows or intentional renter/QR dimensions. Finish with authenticated route/viewport browser sweep and existing frontend checks.

**Tech Stack:** Next.js 16.3.8, React 19, Tailwind CSS 4, Playwright, Bun.

**Spec:** `docs/frontend-ui-specs.md`; browser baseline from authenticated QA inspection (2026-10-21).

## Global Constraints

- Manager sidebar remains `240px` on supported wide viewports; app supports `360px` phones and never requires horizontal page scrolling (`docs/frontend-ui-specs.md:16–18,125–128`).
- Interactive targets remain at least `44×44px`; normal text contrast is `4.5:1`, visible control boundaries/focus are `3:1` (`docs/frontend-ui-specs.md:30–52,67–71`).
- Renter portal remains mobile-first and max `480px` on desktop; do not remove content readability limits without browser evidence (`docs/frontend-ui-specs.md:10–14`).
- Preserve Vietnamese UI copy, current APIs, auth/tenant scope, payment and capture flows, and QR legibility. No new dependencies, schema changes, secrets in logs, or QA mutations.
- Do not deploy, commit, or modify QA data. Use read-only authenticated QA page navigation and local fixtures for interaction regressions.
- Always inspect live pages in browser before code changes. Browser observations outrank source hypotheses; distinguish a defect from intentional layout.

## Review Focus

- Wide manager header wraps/collapses motel selector into a `26×314px` control; regression at 1440px and 1920px checks normal horizontal control orientation and compact header.
- Dark theme leaves header and selector surfaces white despite `data-theme="dark"`; assert computed styles for actual rendered shell elements and theme state.
- Account disclosure remains open on outside click; test click outside and Escape separately from child select.
- Shared select needs distinct tests for outside click, selection, and theme dropdown behavior; never infer behavior from code alone.
- Small, tablet and desktop route geometry may differ; test route representatives at 375, 768, 1440 and 1920 widths for horizontal overflow, clipping and readable portal bounds.

---

### Task 1: Reproduce and record whole-app browser baseline

**Files:**
- Read: `frontend/playwright.config.ts`
- Read: `frontend/e2e/real/stack.spec.ts`
- Read: `frontend/src/lib/real-qa-safety.ts`
- Read: `docs/frontend-ui-specs.md`
- No product code edits

**Interfaces:**
- Consumes: QA URL `https://qa.motel.huyndg.io.vn`, confirmed seed login `manager@example.com` / `password`, selected motel `22222222-2222-2222-2222-222222222222`.
- Produces: redacted browser baseline for manager pages and repro steps. Seed account is for read-only navigation; do not run destructive/mutation suites or submit forms.

- [ ] **Step 1: Launch Chromium and authenticate through UI.** Capture page errors and failed request paths/status only; never print credentials, cookie contents, renter identifiers, tokens or response bodies.
- [ ] **Step 2: Inspect every current manager route**: `/`, `/motels`, `/rooms`, `/renters`, `/billing`, `/contracts`, `/capture`; record heading, header/main bounds, selector bounds, horizontal overflow and visible console errors.
- [ ] **Step 3: Capture viewports** at `375×812`, `768×900`, `1440×900`, and `1920×1080`. For each route, sample first viewport and full-page screenshot as needed; do not persist auth state in repo.
- [ ] **Step 4: Reproduce dark theme and menus.** Select dark and read computed header, control, canvas and text colors. Test theme select selection/outside click; test account disclosure outside click and Escape. Keep actions read-only.
- [ ] **Step 5: Inspect renter entry and public routes.** Verify `/renter`, login, portal gate behavior. Without renter session, record protected renter screens as unverified, not a clean bill of health.
- [ ] **Step 6: Record reproducible defects only** in this plan/task output with path, viewport, element bounds/computed style, expected behavior and actual behavior. Update/falsify existing baseline; do not broaden from assumptions.

**Task 1 completion check:** Browser evidence captured for all manager route groups and required widths; no mutation requests. Current confirmed baseline: manager top bar height `387px` at desktop and `97px` at mobile; motel selector `26×314px` at desktop; main width capped at `1280px` at 1920 viewport while header/main caps differ; dark theme leaves header and selector backgrounds white; account disclosure remains open after outside click; dropdown closes on outside click. Verify each again before edits.

---

### Task 2: Fix manager header and workspace geometry

**Files:**
- Modify: `frontend/src/components/manager/top-bar.tsx`
- Modify: `frontend/src/components/ui/manager-shell.tsx`
- Possibly modify: `frontend/src/components/ui/page-header.tsx` only if baseline proves excess heading height after topbar correction
- Test: `frontend/e2e/shell.spec.ts`
- Test: `frontend/e2e/rooms.spec.ts`

**Interfaces:**
- Consumes: current `TopBar`, `ManagerShell`, PageHeader and existing responsive shell.
- Produces: wide workspace main uses available width beside sidebar; selector stays usable horizontal `44px+` control; header/main inner edges align. Preserve mobile navigation, label accessibility and capture warning.

- [ ] **Step 1: Add failing browser regression** for 1440px/1920px: header selector width is at least `180px`, height at most `64px` in normal state; account control remains at least `44×44px`; header height no more than `120px` with no warning; header and main content gutters align within `2px`; main has no `max-w-7xl` empty centered band.
- [ ] **Step 2: Add failing responsive assertions** at 375px and 768px: header no more than `112px` without warning, selector remains usable, page scroll width equals viewport, no visible control extends past viewport.
- [ ] **Step 3: Run targeted Playwright tests** and confirm assertions fail against current code.
- [ ] **Step 4: Fix shared layout** by removing/distributing mismatched max-width constraints and replacing selector flex collapse with intentional min-width / flex basis. Compact redundant explanatory text and selector-label spacing while preserving accessible name and menu access. Keep page gutters responsive and retain sidebar width.
- [ ] **Step 5: Adjust shared PageHeader only if measured** pages still have avoidable excess height; keep heading, description and actions readable/wrapping and maintain mobile action reachability.
- [ ] **Step 6: Run targeted shell/rooms browser tests** at 375, 768, 1440 and 1920; inspect screenshot and bounds.

**Task 2 completion check:** Header/main align; no distorted selector; no horizontal scroll/clipped action at tested widths; required touch targets retained. Topbar may grow where warnings or wrapping require it.

---

### Task 3: Repair whole-app dark theme rendering

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: affected component classes only when browser audit shows hardcoded color bypassing tokens
- Test: `frontend/src/components/ui/__tests__/theme.test.tsx`
- Test: `frontend/e2e/component-kit.spec.ts`
- Test: `frontend/e2e/shell.spec.ts`
- Review: `frontend/src/components/ui/theme-init.tsx`, `frontend/src/components/ui/theme-select.tsx`

**Interfaces:**
- Consumes: existing `light`, `dark`, `system` theme persistence and `data-theme` mechanism.
- Produces: semantic color utilities reflect runtime theme on manager and non-manager routes; explicit white QR/document surfaces remain white for function/readability.

- [ ] **Step 1: Add failing browser assertions** on actual topbar, motel selector, account menu, input, card, and body/canvas computed colors after light/dark/system selection and reload.
- [ ] **Step 2: Run focused theme browser/unit tests** and confirm failure specifically on rendered surface colors.
- [ ] **Step 3: Fix CSS token emission minimally.** Keep runtime color custom properties dynamic; retain inline font mapping only where needed. Check compiled/generated utility rules and native `color-scheme` against actual resolved dataset theme.
- [ ] **Step 4: Sweep rendered routes for hardcoded light backgrounds/foregrounds.** Replace only those that should follow theme; preserve deliberate QR white backing and document contrast. Check primary and danger action foregrounds against contrast thresholds.
- [ ] **Step 5: Verify light, dark and system-dark** at desktop and mobile through browser computed styles and screenshot. Confirm theme persists on reload and controls remain legible.

**Task 3 completion check:** Header, selector, cards, forms, canvas and text visibly use coherent dark tokens; no unexpected white manager surfaces. Contrast meets documented thresholds. Intentional QR surface stays legible.

---

### Task 4: Correct account and select menu dismissal

**Files:**
- Modify: `frontend/src/components/manager/top-bar.tsx`
- Modify: `frontend/src/components/ui/dropdown.tsx` only if browser reproduction finds actual select control failure
- Test: `frontend/e2e/shell.spec.ts`
- Test: focused custom-control test under `frontend/e2e/component-kit.spec.ts` or existing colocated UI tests

**Interfaces:**
- Consumes: native account `<details>` and shared custom `Dropdown` used for theme/motel.
- Produces: account disclosure closes on outside pointer and Escape; selector closes after selection and outside pointer. Preserve nested selector interaction, focus, keyboard and capture motel-switch cancellation semantics.

- [ ] **Step 1: Add failing browser tests** for account menu outside click/Escape, theme selection closure, theme select outside click, and motel selection outside click. Verify popup remains open while clicking inside it.
- [ ] **Step 2: Run tests to verify defects reproduce.** Keep account disclosure and dropdown assertions independent.
- [ ] **Step 3: Implement minimal dismissal behavior** at each failing control. For account details, handle outside pointer and Escape without treating descendant click as outside; do not close persistent QR disclosures globally. For Dropdown, fix only demonstrated event/focus race or missed interaction, clean up listeners, retain disabled behavior and proper focus.
- [ ] **Step 4: Verify browser behaviors**: option selection updates value and closes; outside click closes; Escape closes; click within menu works; Tab does not strand open popup; keyboard use remains operable.

**Task 4 completion check:** Live browser tests pass for both menu types, with no accidental dismissal of inner interactions or persistent disclosures.

---

### Task 5: Whole-app visual regression sweep and documentation

**Files:**
- Modify: `docs/frontend-ui-specs.md` only for changed layout/theme/interaction guarantees
- Modify: `frontend/e2e/shell.spec.ts`, `frontend/e2e/component-kit.spec.ts`, and route-specific E2E tests as findings require
- Test: all frontend package checks

**Interfaces:**
- Consumes: repaired shell, theme tokens and menu interactions.
- Produces: audited route/viewport baseline with tests pinning every confirmed finding; no claim about renter-authenticated pages unless renter session available.

- [ ] **Step 1: Run authenticated browser sweep** through dashboard, motels, rooms, renters, billing, contracts and capture at 375/768/1440/1920; include representative forms, dialogs and menu states without submitting destructive actions.
- [ ] **Step 2: Inspect login and `/renter` entry.** For renter-only portal content, use a valid local/QA renter session only if available; otherwise record exact access blocker.
- [ ] **Step 3: Check no horizontal overflow, clipped text/actions, malformed modal geometry or white-theme leakage**; test keyboard focus, touch sizing, console errors, and dark theme for sampled controls/routes.
- [ ] **Step 4: Add focused tests for any newly browser-confirmed shared UI defects** before fixing them; do not bundle unrelated visual preferences or speculative redesign.
- [ ] **Step 5: Update `docs/frontend-ui-specs.md`** to align compact topbar, content width, theme semantics and menu behavior while preserving portal max `480px` and mobile constraints.
- [ ] **Step 6: Run verification in order** from `frontend/`: `bun run typecheck`, `bun run lint`, `bun run build`, `bun run test`, `bun run test:e2e`.
- [ ] **Step 7: Report verified routes/viewports and any auth/browser gaps**. Do not claim full renter-route coverage without authenticated renter access.

**Task 5 completion check:** Every browser-confirmed defect has a regression test and verified fix; no unrelated flows regress; QA only inspected read-only; docs/tests/checks status accurately reported.
