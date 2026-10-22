# Whole-app theme, layout, and dropdown repair

## Goal and scope
Fix incomplete dark mode, wasted horizontal space, oversized headers, and dropdown dismissal across the app. User explicitly expanded scope beyond Rooms to the whole app. Preserve current branding, Vietnamese copy, API contracts, tenancy, payment and capture behavior. No backend changes, dependencies, production deployment, or broad redesign.

## Evidence and limits
- `frontend/src/app/globals.css:19–44`: literal colors declared in `@theme inline`; dark overrides at lines 147–168 may not affect compiled utility declarations. Confirm generated CSS/computed styles before changing tokens.
- `frontend/src/components/ui/manager-shell.tsx:5`: main capped at `max-w-7xl`; `frontend/src/components/manager/top-bar.tsx:55`: header capped differently at `max-w-6xl`.
- Top bar stacks explanatory text, selector label, and control with vertical padding (`top-bar.tsx:54–59`). Shared page heading adds generous gap/padding (`components/ui/page-header.tsx:4`).
- `components/ui/dropdown.tsx:39–59,97–106` already attempts selection/outside-mousedown/Escape dismissal. Do not claim absent handlers explain live issue. Keyboard option navigation and focus-leave dismissal are absent; placeholder always emits an empty value.
- Account popup is a separate native details element (`top-bar.tsx:61–72`) without outside/Escape dismissal. Distinguish popup from nested theme selector during reproduction.
- `components/ui/portal-shell.tsx:5` deliberately caps portal at 480px; global desktop body gradient assumes a 240px manager sidebar even on other routes (`globals.css:199–203`).
- QA URL fetched successfully but redirected to login. Live browser interaction and geometry remain unverified: execution denied under planning permissions. Working tree clean on branch `flaxen-mochi` at inspection.

## Layout defaults
Use full available manager workspace width with consistent responsive gutters. Across renter/public routes remove accidental shell restrictions, but keep intentional reading/form constraints and scannable QR/document surfaces. This is a proposed default, not a separately approved visual specification. Keep portal full-page dark canvas around bounded content. Target compact top bar near 64px desktop / 56px mobile in ordinary state; allow growth for wrapping, zoom, validation, and capture warnings. Preserve at least 44px touch targets and accessible labels. Preserve white QR/document backgrounds where function requires them.

## Local review environment setup
To launch stack locally for manual UI review:
1. Ensure PostgreSQL 16 is running on port 5432 with databases `motel` and `motel_test`.
2. Backend setup:
   ```bash
   cd backend
   # verify .env has DATABASE_URL, TEST_DATABASE_URL, secrets (see .env.example)
   bun install --frozen-lockfile
   bun run db:migrate
   bun run dev
   ```
   Runs on `http://localhost:3000`.
3. Frontend setup:
   ```bash
   cd frontend
   # verify .env.local has BACKEND_URL=http://localhost:3000
   bun install --frozen-lockfile
   bun run dev
   ```
   Runs on `http://localhost:3001`.
4. Navigate to `http://localhost:3001/login` or `http://localhost:3001/rooms?motel=<id>` to review UI interactively.

## Implementation sequence
1. **Reproduce before editing.** In implementation-capable mode, use installed Playwright browser tooling. Compare current branch with QA deployment revision before attributing live behavior to local code. Use existing real-stack login configuration (`E2E_REAL`, `E2E_FRONTEND_URL`, `E2E_LOGIN_EMAIL`, `E2E_LOGIN_PASSWORD`) without printing secrets or persisting authenticated storage. Honor QA safety guards. If credentials unavailable, report blocker; fixture browser checks are not live QA proof. Do not run unrelated mutation-heavy real-stack suites.
2. **Record baseline.** Capture redacted screenshots/computed colors and bounding boxes at 375, 768, 1280, and 1920px. Inspect supplied Rooms URL, remaining manager routes, login, renter/portal routes and shared dialogs/forms. Test explicit light/dark, system-dark, reload persistence and OS-theme change. Reproduce each dropdown separately: choose option, choose current option, pointer outside, Escape, Tab, touch, and keyboard selection. Record console/network errors without sensitive payloads.
3. **Add failing regressions.** Extend existing shell/component/theme E2E tests, not text-only CSS checks. Assert computed surface/text changes, aligned full-width main/header gutters at wide desktop, compact ordinary header, no horizontal overflow and no clipped actions. Test account and selection popups independently. Cover theme invalid-empty selection, disabled controls, and motel switching cancellation. Extend representative renter/public coverage for global token changes.
4. **Repair runtime colors at source.** Separate non-inline runtime color tokens from inline font mappings, or use minimal runtime aliases after checking installed Tailwind output. Ensure semantic background, foreground, border, status, focus, and selected-state utilities respond to theme. Reconcile native `color-scheme` with actual resolved theme. Remove/sidebar-scope global desktop gradient if it creates non-manager artifacts. Audit hardcoded light colors app-wide; replace inappropriate ones with semantic tokens, preserve functional QR/document backgrounds. Check payment proof button and capture danger action contrast.
5. **Repair shared geometry.** Align main/top-bar widths and gutters; remove manager workspace max-width cap. Compact redundant top-bar explanatory copy and selector label layout while retaining accessible names. Reduce page-header spacing without shrinking targets. Keep capture warnings visible and flows untouched. Inspect all route-group shells and page-level width caps: keep explicit readability constraints, remove accidental workspace clipping. Responsive grids must fill new available space without excessive card widths or horizontal scroll.
6. **Repair controls minimally.** Prefer existing native select/SelectField for simple motel/theme selection if it satisfies required behavior; avoid building a custom combobox. Preserve current selection, disabled states, labeling, and cancelable capture motel-switch event. Theme must accept only light/dark/system and motel selection must not introduce an invalid empty ID. If custom dropdown is retained, implement complete keyboard focus/selection plus pointer-outside, Escape, and focus-leave dismissal with cleanup. Give account popup explicit dismissal on outside pointer, Escape, completed selection/action and navigation; avoid dismissing on interaction inside nested selector. Restore focus only when appropriate, never steal it from an outside-click target. Preserve logout errors/cancelation and capture protections. Do not apply transient-menu dismissal to persistent QR disclosures.
7. **Verify and document.** Update `docs/frontend-ui-specs.md` for actual token/layout/interaction changes; update testing contract only if guarantees change. Read relevant installed Next docs before Next-specific edits. Run frontend `bun run typecheck`, `bun run lint`, `bun run build`, `bun run test`, `bun run test:e2e` in repo-prescribed order. Record available coverage using existing tooling, plus route/theme/viewport interaction coverage. If browser libraries or authenticated QA access block validation, report explicitly rather than claiming pass.

## Acceptance and rollout
- Shared UI surfaces visibly dark with readable contrast; switching and reload work across all route groups. Functional QR white area is not considered a dark-mode failure.
- Manager main fills remaining width beside sidebar; header aligns with main gutters; no clipping at mobile, desktop, or 200% zoom. Intentional form widths documented, not removed blindly.
- Dropdowns dismiss after selection and outside interaction; account popup cannot remain accidentally stranded. Keyboard and touch behavior work without lost labels/focus.
- No API changes, data migrations, tenant access changes, or capture/payment regressions.
- Finish with local verified diff and redacted browser evidence. No commit/push/deploy without user instruction. If QA deployment subsequently authorized, rerun targeted authenticated visual/interaction checks against that deployed revision; rollback via normal previous release, not database changes.
