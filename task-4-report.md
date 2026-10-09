# Task 4 report

## Scope

Implemented Core UI v2 data display and navigation primitives from `task-4-brief.md`.

## Changes

- Added `Card`, `StatusBadge`, `Progress`, `MobileDataRow`, `Tabs`, and `Accordion`.
- Added data primitive tests covering Vietnamese accent folding, BigInt sorting, pagination clamping, empty results, mobile labels, status semantics, progress semantics, and navigation roles.
- Updated table search folding to remove Vietnamese diacritics while preserving `BigInt` sort values.

## Verification

- `bunx vitest run src/components/ui/__tests__/data-primitives.test.tsx`: pass, 5 tests.
- `bunx vitest run`: 392 passed, 3 pre-existing theme failures.
- `bunx tsc --noEmit`: blocked by stale `.next/dev/types` generated-route errors.
- `bunx eslint`: pre-existing `theme-select.tsx` error plus four image warnings.
- Playwright not run; no Task 4 component-kit execution was available in this checkout.

Pre-existing failures remain outside Task 4 scope: theme storage/system CSS tests, generated Next route types, and theme-select lint rule.

## Review fixes

- Tabs now expose stable tab/panel IDs, `aria-controls`, `aria-labelledby`, and roving Arrow/Home/End keyboard behavior.
- Accordion keeps every controlled panel in the DOM and toggles `hidden` while closed.
- Progress normalizes non-positive/non-finite max and values, clamps the range, and removes width transitions.
- Added rendered interaction coverage to the Playwright component-kit for table search/sort/pagination, digit-string money sorting, Tabs, Accordion, and Progress.
- Review-focused Vitest contract tests: 8 passed.
- Added duplicate-instance regression: two Tabs instances now receive unique `useId`-prefixed tab/panel IDs and scoped focus lookup; focused suite now 9 tests passed.
