# Core UI v2 Design Spec

## Goal

Create one stable, accessible Core UI v2 layer before building remaining manager and renter screens. New screens must compose shared primitives instead of inventing local dialogs, tables, forms, status styles, upload flows, or responsive navigation.

## Success criteria

- Existing screens keep behavior and remain source-compatible during migration.
- Every primitive has typed props, light/dark rendering, keyboard/focus behavior, loading/pending, error, empty, and disabled states where applicable.
- Manager and renter layouts share tokens but preserve their different workflows.
- Controls keep a minimum 44x44px hit area and no horizontal scrolling at 360px.
- Money stays VND digit-string safe; dates stay calendar-day safe; status uses text plus color.
- Component tests and browser tests cover primitive behavior before domain screens migrate.

## Scope

### Foundation

Semantic tokens for light/dark/system themes, typography, spacing, radius, borders, surfaces, status colors, focus rings, motion, safe areas, and a shared class merge helper if needed. Existing tokens remain canonical unless contrast review proves a change necessary.

### Shell primitives

`AppShell`, `ManagerShell`, `PortalShell`, `Sidebar`, `BottomNav`, `TopBar`, `MotelSwitcher`, `PageHeader`, `SectionHeader`, and responsive content container. These own layout only; route data stays in route components.

### Feedback and overlay primitives

`Dialog`, `Drawer`, `ConfirmDialog`, `Toast`, `Alert`, `StatusStrip`, `Skeleton`, `EmptyState`, and `ErrorState`. Dialogs restore trigger focus; destructive actions require explicit confirmation.

### Data primitives

`Card`, `StatCard`, `Badge`, `StatusBadge`, `Progress`, `DataTable`, `MobileDataRow`, `FilterBar`, `Tabs`, and `Accordion`. Tables support search, sort, pagination, labelled mobile rows, and money-safe sorting.

### Form and upload primitives

`Field`, `MoneyField`, `DateField`, `SelectField`, `TextAreaField`, `FileUpload`, `ImagePreview`, `FormErrorSummary`, and `ActionBar`. File primitives expose file type/size errors, preview/removal, pending upload, retry, and private-image placeholder states without exposing storage keys.

### Domain compositions

Deferred until primitives pass: `RoomCard`, `RenterCard`, `InvoiceSummary`, `ContractSummary`, `ContractWizard`, `TemplateEditor`, `PaymentProofReview`, and `TicketCard`.

## Compatibility

Keep existing default exports and prop contracts for `Button`, `Field`, `Modal`, `Drawer`, `Badge`, `StatCard`, `EmptyState`, `DataTable`, `ToastProvider`, and `useToast`. Add v2 props only when backward compatible. Migrate callers incrementally; do not rewrite all screens in one change.

## Accessibility and responsive rules

Use semantic HTML, visible labels, linked errors, `aria-live` for async status, focus-visible rings, focus restoration, keyboard-operable menus/tabs/dialogs, and reduced-motion handling. Validate widths 360, 375, 430, and 1280. Fixed mobile chrome must never cover focused controls; content uses safe-area-aware bottom padding.

## Theme rules

Support `light`, `dark`, and `system` with early initialization to avoid flash. Dark palette uses canvas `#0F172A`, surface `#111827`, raised `#1E293B`, text `#F8FAFC`, muted text `#CBD5E1`, border `#334155`, and contrast-checked primary/status colors. No raw component hex values.

## Testing gate

Before domain migration, tests must cover: primitive rendering contracts, keyboard focus and restoration, dialog Escape, table mobile reflow/search/sort/pagination, form error association, money/date input validation, file MIME/size/preview states, dark theme persistence/system fallback, reduced motion, and no overflow at required widths. Run frontend typecheck, lint, Vitest, build, and relevant Playwright component/shell suites.

## Out of scope

No backend endpoint changes, no CCCD storage implementation, no payment-proof API, no manager ticket API, no new business rules, and no fake data. Those belong to separate backend/API delivery plans.
