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
