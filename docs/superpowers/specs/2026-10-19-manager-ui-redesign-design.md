# Manager UI Redesign — Quiet Ledger

- **Date:** 2026-10-19
- **Status:** Approved design; implementation complete and submitted in PR #21 (`feat/manager-ui-redesign-implementation` → `feat/manager-ui-redesign`)
- **Scope:** Manager web application only; renter portal and meter-capture standalone PWA remain unchanged except shared primitives where visually necessary.
- **Companion:** [Frontend UI/UX Specs](../../frontend-ui-specs.md), [API Contract](../../api-contract.md), approved Quiet Ledger dashboard mockup at `.superpowers/brainstorm/2914424-1792427800/content/dashboard-quiet-ledger.html`.

## 1. Intent and outcome

Replace the current Manager UI’s visual composition with a consistent Quiet Ledger operating interface. The manager should identify the next operational action, understand room/invoice state at a glance, and complete on-site work on a phone without losing desktop efficiency. Preserve existing routes, API semantics, motel scoping, form guarantees, and Vietnamese copy. This is a visual/interaction redesign, not authorization to add backend endpoints or fabricate unavailable business metrics.

Success means every existing manager destination uses the same shell and coherent visual hierarchy; key workflows remain usable by keyboard and touch; no horizontal page overflow occurs at 360px–1440px; all displayed metrics reflect available API data; and fixture-backed plus real-browser validation demonstrates actual interactions and outcomes.

## 2. Current constraints and verified baseline

- Implementation status: complete on `feat/manager-ui-redesign-implementation`, commit `3c9588f`, submitted as open PR #21 targeting `feat/manager-ui-redesign`.
- `docs/frontend-ui-specs.md` is the source of truth for screen behavior, API availability, statuses, and currently deferred features.
- Quiet Ledger direction and token values are already present in `frontend/src/app/globals.css`: canvas `#F3F6F8`, white surfaces, ink `#172B3A`, teal `#087E8B`, mustard `#E9B949`, semantic statuses, and existing Vietnamese-capable fonts. Retain these values unless user approves a separate token change.
- Manager shell is `frontend/src/app/(manager)/layout.tsx` → `ManagerShell`, `Sidebar`, `TopBar`. Current mobile bottom navigation includes six destinations; redesign must expose no more than five primary destinations and provide a labelled secondary menu.
- Dashboard in `frontend/src/app/(manager)/page.tsx` currently displays room/renter metrics, task links, and quick actions. Existing APIs provide rooms, renters, billing periods, invoices, and motel information. Revenue/unpaid balance can be derived from current-period invoices only when period/invoice data exist. Ticket administration has renter-only endpoints; no manager ticket endpoint exists.
- Capture has a separate route group under manager and specialized offline/PWA interaction. Keep these behaviors and avoid forcing desktop chrome into the focused room-reading workflow.
- Existing component kit, form validation, dialogs, upload controls, URL motel selection, pending-state protections, and tenant scoping remain authoritative. No new UI dependency is needed.
- Pending backend API changes are not assumed ready. Re-check `docs/api-contract.md` and implemented routes at the start of each relevant implementation phase; use only verified endpoints.

## 3. Visual system and interaction principles

### Visual language

- Quiet Ledger: restrained ledger-like hierarchy, navy shell, pale blue-gray canvas, white work surfaces, teal primary actions, mustard used sparingly for attention, semantic status colors.
- Avoid interchangeable grids of rounded cards. Prefer aligned measures, grouped ledger rows, clear dividers, compact action lists, and restrained borders. Elevation is for overlays, not ordinary content.
- Maintain existing font families and semantic tokens. Body text stays at least 16px on mobile and 14px on wide screens; amounts use tabular numerals. Labels use sentence case, not decorative all-caps.
- Use existing SVG/icon assets or installed icon conventions; no emoji or text-number placeholders as production icons.
- UI reference mockup is directional for dashboard layout, not authority for placeholder business content, fabricated backend fields, or exact data values.

### Responsive shell

- Wide screens: sticky navy sidebar approximately 240px; content has readable max width; top bar carries motel switcher, operational warning/notification affordance only if supported, and manager account actions.
- Mobile: compact header and bottom navigation with at most five primary destinations; secondary routes are available through a clearly named “Thêm”/menu surface. Maintain 44×44px minimum action targets, safe-area padding, keyboard access, visible focus, and no hover-only controls.
- Motel selection remains global URL-backed state; switching motel retains current route and supported filters, refreshes scoped data, and preserves capture queue safety behavior.
- Reflow tables/cards/forms rather than creating page-level horizontal scrolling. Test widths 360, 375, 430, 640, 768, 1024, and 1440px, with additional intermediate width checks where clipping is plausible.

### States and accessibility

Every redesigned screen retains existing loading, error/retry, empty, conflict, pending, success, and destructive-confirmation behavior. Status meaning cannot rely on color alone. Preserve focus return, error association, reduced-motion behavior, upload button/dropzone plus mobile picker, and server-truth refresh after mutations. Do not introduce a different state machine merely for visual consistency.

## 4. Screen and phase scope

### Phase 0 — Shared foundation audit

Inventory actual Manager routes, shared UI components, current test coverage, API callers, and latest backend readiness. Reconcile stale statements between this spec and `docs/frontend-ui-specs.md` only when verified. Keep existing primitives where contracts fit; change shared shell/components only when needed for the selected design. No broad refactor or new dependency.

### Phase 1 — Shared tokens and primitives

Audit current Quiet Ledger tokens against actual component use and make only verified semantic fixes. Refine reusable Manager-specific visual primitives (page heading/action layout, ledger row, measure group) only where existing components cannot express the approved composition. Keep primitive API small and aligned with existing UI contracts; avoid premature generalization.

### Phase 2 — Shell and navigation

Redesign shared sidebar, top bar, mobile navigation, page frame, and shared page-heading/action hierarchy. Keep all working destinations reachable. Desktop primary navigation includes currently built routes only: Overview, Motels, Rooms, Renters, Billing, Contracts. Mobile presents at most five primary routes; group remainder under labelled menu. Do not expose deferred ticket administration or dedicated settings routes without corresponding API/UI scope. Preserve motel switcher, capture queue warning, theme/account/logout behavior, and auth redirect.

### Phase 3 — Overview dashboard

Adopt approved mockup’s hierarchy: page heading/date and primary renter action; compact grouped operational measures; invoice ledger list; fast task actions; selected motel context. Reuse existing reads and derive only defensible values:

- Room count and occupancy from complete selected-motel room list, preserving documented denominator/status rules.
- Current period and invoice totals from existing billing APIs. Unpaid count/amount includes only unsettled states and must not invent due dates.
- Revenue estimate appears only when its definition and available invoice set are unambiguous; otherwise omit measure or show a purposeful empty state, not zero-filled unsupported data.
- No unresolved-ticket tile/widget until manager API exists.
- Empty motel / no rooms / no billing period / failed reads remain distinct states.
- Quick actions route to existing meter capture, billing, and renter creation flows with selected motel preserved.

### Phase 4 — Meter capture workflow

Redesign entry points and supported manager capture list/period overview to fit Quiet Ledger while preserving one-handed use, offline queue, stale-write conflict handling, photo upload/preview, retry, and explicit draft/sent behavior. Keep focused room-reading route PWA-like, mobile-first, and free from unnecessary shell chrome. No changes to capture validation or sync semantics as part of visual work.

### Phase 5 — Billing, invoices, and QR/payment review

Apply ledger rows and clear status hierarchy to billing periods, invoice lists/detail, QR display, payment proof review and cash actions where existing APIs and UI exist. Preserve exact VND arithmetic, server-authoritative payment transitions, distinct approve/reject/cash actions, pending guards, receipt/proof privacy, and conflict refresh. Never expose QR/payment details on unrelated screens. No renter payment-state mutation.

### Phase 6 — Motels, rooms, renters, contracts

Bring motel grid/settings form, room listing and filters, renter list/detail and CCCD controls, and contract list/create/detail/templates into shared visual language. Preserve URL filters, motel scope, partial update semantics, private CCCD signed URLs and manager-only access, contract consent/evidence semantics, file limits, upload controls, and all existing field-level/form-level error behavior. Existing screen functionality remains; no new data fields or destinations.

### Out of scope

- Backend endpoint/schema/business-rule changes; new manager ticket management; dedicated settings route; provider-specific notification controls; unsupported dashboard analytics.
- Renter portal redesign, capture sync redesign, adding new CRUD/workflows, replacing Next.js/Tailwind or existing UI primitives, dependency additions, QA/production deployment, and destructive QA mutations.
- Rewriting API contracts or changing route semantics to accommodate visual components.

## 5. Data/API and module boundaries

Pages continue to use existing server-side API clients and route-specific components. Shared visual components accept presentation-ready props and do not fetch domain data or import database/domain modules. No browser calls to backend origin: preserve same-origin `/api` transport. Keep financial calculations in existing BigInt-safe money helpers; no floating-point VND. No manager identity or motel scope supplied as trusted client data; server session remains authority.

Any API readiness discrepancy blocks only the affected screen/metric and must be recorded in the implementation phase. Do not solve it by inventing fixture production behavior or changing backend contract under this redesign.

## 6. Verification and release gates

For each phase:

1. Add or update component/unit tests for changed responsive structure, data formatting, and state behavior; tests must assert behavior, not only snapshots/classes.
2. Run relevant fixture-backed Playwright interactions for navigation, keyboard, touch target/action, empty/error/pending outcomes, and motel switching.
3. Run browser visual/geometry checks at 360, 375, 430, 640, 768, 1024, and 1440px: viewport overflow, clipped content, sticky/fixed navigation, dialog bounds, and readable row reflow.
4. Run real-stack E2E for actual manager core flows where the dedicated QA setup is available and safely configured. Do not claim fixture tests establish real-user backend usability.
5. At completion run frontend checks in documented order: `bun run typecheck`, `bun run lint`, `bun run build`, `bun run test`, `bun run test:e2e`; record any browser OS dependency blocker separately. Run backend checks only if implementation changes backend (which is out of scope here).
6. Review all screen states, compare to approved mockup and UI specs, inspect console/network errors, and update `docs/frontend-ui-specs.md` for durable visual/interaction changes. Record and inspect test coverage as required by project constraints.

Phase completion requires existing behaviors preserved, no clipping/overflow at target viewports, no unsupported navigation/data, accessible keyboard/touch interactions, and green relevant tests. Full redesign completion requires all phases and final whole-app regression verification.

## 7. Acceptance criteria

### Completion record

Implementation is complete on `feat/manager-ui-redesign-implementation` and submitted as PR #21 targeting `feat/manager-ui-redesign`. Final frontend checks passed: typecheck, lint, build, 613 unit tests, and 105 fixture E2E tests. Coverage: 91.19% statements, 95.71% lines, 86.94% functions, and 86.05% branches. Real-stack QA E2E was not run because no safe QA target was configured; no QA/production changes or deployments occurred. Capture overview does not display per-period progress or queue summaries because the list API does not provide those values.


- Shared Manager shell matches approved Quiet Ledger direction and all currently supported Manager routes use it consistently.
- Mobile navigation has at most five primary destinations and all supported routes remain discoverable.
- Dashboard prioritizes actual operations and uses only verified API-backed numbers; unsupported ticket information is absent.
- Meter, billing/payment, motel, room, renter, and contract flows preserve documented API contracts and current safety invariants.
- Interface remains readable and operable from 360px mobile through 1440px desktop, with keyboard access, visible focus, adequate contrast, labelled controls, and no page-level horizontal overflow.
- Tests cover behavioral and responsive regressions; final test coverage is inspected and recorded.
- No backend/deploy/QA mutation or new dependency is included without separate explicit approval.
