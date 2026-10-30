# ADR 0011: Migrate to shadcn/ui and Motion

## Status

Accepted

## Context

The frontend previously utilized 37 custom, zero-dependency UI primitives located in `frontend/src/components/ui/`.
While this avoided external dependencies, standardizing accessibility (WAI-ARIA compliance, focus trapping, roving tab-index, portal layering, screen-reader announcements) across complex controls (Dialogs, Dropdowns, Selects, Accordions, Tabs) requires significant maintenance overhead. Furthermore, rich motion interactions (e.g., active navigation indicators, page transitions, toasts) benefit from declarative, reduced-motion-aware libraries rather than ad-hoc CSS animations.

## Decision

1. Adopt vendored shadcn-style components (built on Radix UI primitives and Tailwind CSS) for
   interactive controls:
   - Dialog, including modal and side-sheet drawer presentations (`@radix-ui/react-dialog`)
   - DropdownMenu (`@radix-ui/react-dropdown-menu`)
   - Select (`@radix-ui/react-select`)
   - Tabs (`@radix-ui/react-tabs`)
   - Accordion (`@radix-ui/react-accordion`)
   - AlertDialog, Button, Input, Textarea, Label; Button composition uses Radix Slot.
2. Adopt `sonner` for accessible, stacked notifications, integrated via `ToastProvider` / `useToast`.
3. Adopt `motion/react` for selective route and navigation transitions.
4. Maintain existing semantic design tokens (`primary`, `border-strong`, `surface`, `canvas`, etc.) and Vietnamese localization across all newly adopted components.
5. Migrate screen-level controls directly to `components/ui/shadcn/` primitives while delegating
   `Button` and `Modal`/`Drawer` in `components/ui/` to the new Radix-backed primitives. Retain
   specialized first-party components (`DataTable`, `Field`, `Dropdown`, `Tabs`, `Accordion`,
   `SelectField`) where product contracts (Vietnamese case-folded search, sorting, pagination, VND
   arithmetic, or render-callback field accessibility) exceed generic shadcn primitives.
6. Allow standard backdrop dismissal for ordinary Modal flows; callers with pending or destructive
   work can prevent outside interaction locally. Drawer retains a right-side mobile sheet layout.
7. Honor `prefers-reduced-motion` for Motion and CSS; route transitions do not animate opacity or
   position when the preference is active.

## Consequences

- Requires new dependencies: `@radix-ui/react-*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `sonner`, `motion`, `lucide-react`.
- Radix Dialog and Select portal to `document.body` or top-layer elements; tests interacting with overlays must query the document root rather than local render containers.
- Motion client boundaries must be declared with `"use client"` when wrapping or utilized within Server Components.
- Some legacy controls remain as compatibility facades so existing callers and tests can migrate
  incrementally; removal requires a repository-wide import audit.
- Custom zero-dependency constraint in `docs/frontend-ui-specs.md` is updated to reflect this adoption.
