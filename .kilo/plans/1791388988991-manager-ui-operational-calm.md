# Manager App UI/UX Polish Plan — Operational Calm

## Goal

Polish the complete manager app through shared UI components and consistent page composition. Keep backend/API contracts, Vietnamese copy, phone-first behavior, existing semantic palette as baseline, same-origin transport, and accessibility guarantees unchanged.

Scope includes dashboard, motels, rooms, renters, billing/invoices, manager shell, and reusable UI primitives. Billing remains first validation flow because it has highest operational risk, but no screen is excluded from the redesign.

## Design direction

Operational calm: bright canvas, navy/slate hierarchy, blue-teal actions, restrained semantic status colors, medium data density. Visual hierarchy comes from type, spacing, surface contrast, and dividers—not decorative gradients or interchangeable card grids.

- Keep Be Vietnam Pro headings and Noto Sans body.
- Keep semantic tokens in `frontend/src/app/globals.css`; adjust token values only after contrast audit.
- Keep 44px minimum controls, visible focus, reduced-motion behavior, safe-area spacing, and no horizontal page scroll at 360–375px.
- Use sentence-case Vietnamese labels and action verbs.
- Status always includes text; color never carries meaning alone.
- Shadows reserved for modal/drawer overlays; ordinary content uses surface contrast and borders.

## Research constraints

- Five primary mobile destinations; secondary menu for low-frequency links.
- Responsive data tables/cards reflow below 640px.
- Meter entry shows previous value, large current input, live usage/cost, and honest save/conflict state.
- `role="status"` for successful save/payment/sync feedback; `role="alert"` for actionable errors.
- QR shows local scannable code plus selectable human-readable payment data.
- Conflicts show local/server values and require explicit re-entry.
- Touch controls remain at least 44×44px with spacing.

## Ordered implementation tasks

### 1. Baseline audit and component contract

- Inventory `frontend/src/components/ui/`, `frontend/src/components/manager/`, manager routes, CSS tokens, and existing tests.
- Capture baseline at 375px and 1280px for `/`, `/motels`, `/rooms`, `/renters`, `/billing`, and invoice/meter routes.
- Define shared component contracts before page edits:
  - `PageHeader`: title, supporting text, primary/secondary actions.
  - `SectionHeader`: section title and contextual action.
  - `ActionBar`: grouped actions with pending/disabled semantics.
  - `StatusStrip`: status text, tone, optional explanation/action.
  - `MetricRow`: restrained operational summary, not decorative card grid.
  - `ResponsiveDataRow`: labelled mobile row and aligned desktop layout.
  - `QrPaymentPanel`: local QR, accessible label, copyable payload, payment facts.
  - Existing Button, Field, Modal, Drawer, Badge, EmptyState, Skeleton, Toast remain single-source primitives.
- Update `docs/frontend-ui-specs.md` with these shared rules and Operational Calm direction before implementation.
- Do not add a UI framework or duplicate one-off primitives.

### 2. Shared primitive polish

- Normalize button sizes, pending state, focus ring, disabled contrast, and touch spacing.
- Normalize Field labels, hints, inline errors, control borders, and validation summary focus.
- Normalize Badge/status tones and text semantics.
- Refine Modal/Drawer spacing, close affordance, focus restoration, and mobile full-width behavior.
- Refine EmptyState, Skeleton, Toast, DataTable, FilterBar, StatCard, and TruncatedText visual hierarchy.
- Add component tests for keyboard access, focus, status announcements, touch dimensions, reduced motion, and 360–375px overflow.

### 3. Manager shell polish

- Refine desktop sidebar grouping, active state, spacing, and 240px sticky layout.
- Refine mobile five-item navigation readability at 375px; keep secondary menu labelled and reachable.
- Refine TopBar motel selector, account menu, notification affordance, page container, and bottom safe-area padding.
- Apply shared `PageHeader`/`ActionBar` pattern to every manager route.
- Preserve motel query scope through navigation and motel switching.

### 4. Dashboard `/`

- Replace generic summary-card treatment with a calm operational header and restrained metric rows.
- Make room occupancy the primary anchor; keep live renter action prominent.
- Preserve honest empty motel/empty room/error states.
- Use shared loading/error/empty patterns and no fabricated billing/ticket measures.
- Verify mobile action order and focus visibility.

### 5. Motels `/motels`

- Improve motel list hierarchy: motel name/address, room count, pricing, bank configuration state, and next action.
- Polish create/edit modal using shared Field, validation summary, and ActionBar contracts.
- Keep VND formatting, bank/account privacy, duplicate/error behavior, and selected motel flow unchanged.
- Ensure empty state points directly to motel creation.

### 6. Rooms `/rooms`

- Refine filter bar, room cards, renter assignment hierarchy, status badges, and price presentation.
- Make create/edit/status dialogs consistent with shared form primitives.
- Keep URL filters, renter join behavior, status semantics, and tenant 404 behavior unchanged.
- Ensure cards remain readable with long Vietnamese names and at 360px.

### 7. Renters `/renters` and detail

- Refine renter table/list into responsive labelled rows with clear room/status/OA distinctions.
- Refine detail header, contract/invoice history sections, CCCD media states, and magic-link action.
- Keep safe image URL handling, copy feedback, phone formatting, and existing API joins unchanged.
- Preserve honest null/empty/error states.

### 8. Billing period, meter, invoice flow

- Period list: operational header, status/progression rows, create action, duplicate and empty states.
- Meter entry: prominent previous values, large current controls, live usage/cost preview, abnormal-use hint, room-level saved/conflict state, sent read-only state.
- Conflict: render `READING_CONFLICT.details.server` beside local draft and require refresh/re-entry without losing batch draft.
- Invoice screen: responsive invoice rows, total emphasis, itemized rent/utilities/fees, renter label, paid timestamp only when provided, status actions, and finalization warning.
- QR: local `qrcode` rendering, accessible label, selectable payload and human-readable account/amount/description.
- Preserve no-notification finalization warning, idempotent payment transitions, generic 5xx handling, and money as digit strings/BigInt.

### 9. Fixture, unit, and E2E coverage

- Add fixture-backed component/page tests for every new shared state and manager screen pattern.
- Add billing API fixture tests for all nine routes if absent: paths, methods, bodies, 401, 404, 409, `details.server`, and `details.skippedRooms`.
- Extend Playwright flow: create period → enter readings → save → generate invoice → inspect QR → finalize → mark paid.
- Cover empty motel/period/invoice, conflict, sent read-only, missing QR, duplicate period, payment retry, and generic failure states.
- Add 375px assertions: no horizontal overflow, visible primary actions, readable labels, focus not obscured, and touch target dimensions.

### 10. Verification and review

Run sequentially from `frontend/`:

```bash
bun run typecheck
bun run lint
bun run build
bun run test
bun run test:e2e
```

Run fresh code/security review after tests. Review visual screenshots at 375px and 1280px. Fix Critical/Important findings before commit. Commit only intended worktree files, then push `feat/manager-billing-frontend`.

## Constraints and non-goals

- No backend/API changes unless a real wire mismatch blocks UI; document exception first.
- No offline meter queue, photo upload, contract UI, renter portal, Zalo, or notification UI.
- No invented invoice due/send dates.
- No new dependency except approved local `qrcode` already in branch.
- No floating-point monetary calculations.
- Do not introduce page-specific hex colors or duplicate primitives.

## Acceptance criteria

- All manager screens share one coherent Operational Calm visual language.
- Manager completes billing workflow at 375px without horizontal page scroll.
- Shared controls meet focus, keyboard, status announcement, reduced-motion, and 44px touch requirements.
- Draft/sent/unpaid/paid/overdue/empty/conflict/missing-QR states are explicit in text and semantics.
- Existing API behavior, tenant isolation, money handling, and route scope remain unchanged.
- Typecheck, lint, build, unit tests, E2E, visual review, and fresh code/security review pass before push.
