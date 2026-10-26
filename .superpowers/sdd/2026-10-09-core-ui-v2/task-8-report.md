# Task 8: Core UI delivery gate report

Date: 2026-10-09
Brief: `.superpowers/sdd/2026-10-09-core-ui-v2/task-8-brief.md`
Branch: `feat/ui-stitch-dark-mode`

## Scope

Fixed only Core UI gate failures. Preserved unrelated backend/planning files:

- `backend/src/modules/billing/billing.schema.ts`
- `backend/src/modules/billing/billing.service.ts`
- `.kilo/plans/1791509962994-motel-ui-redesign.md`
- `.kilo/plans/prd_project_brief_smartmotel_platform.txt`
- `docs/superpowers/plans/2026-10-09-core-ui-v2.md`
- `docs/superpowers/specs/2026-10-09-core-ui-v2-design.md`

## Required checks

Commands run from `frontend/` with `PATH="$HOME/.bun/bin:$PATH" bunx`.

| Check | Result | Exact count / blocker |
|---|---|---|
| `bunx tsc --noEmit` | PASS | Exit 0; no diagnostics |
| `bunx eslint` | PASS | Exit 0; 0 errors, 4 existing `@next/next/no-img-element` warnings |
| `bunx vitest run` | PASS | 46/46 test files passed; 419/419 tests passed; skipped 0 |
| `bunx next build` | PASS | Exit 0; 20 routes generated (2 static, 18 dynamic) |
| `bunx playwright test --project=chromium-mobile` | BLOCKED | 85 failed, 0 passed, 0 skipped; Chromium executable missing at `/home/huyndg-pc/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell` |

Playwright browser installation was not attempted; no OS dependencies installed.

## Fixes

- `theme-select.tsx`: defer browser-storage hydration to a microtask to satisfy React hook lint; preserve guarded blocked-storage behavior.
- `theme.test.tsx`: assert blocked storage does not call throwing `setItem`; assert system theme resolves to explicit `light`/`dark` dataset values.
- `sidebar.tsx`: remove Suspense loading fallback around static destination data so server-rendered compatibility markup includes all navigation labels.
- `navigation-link.tsx`: tolerate null navigation mocks during server-rendered tests.
- `shell-ui.test.ts`: use valid React child arguments and avoid `react/no-children-prop` / explicit-any lint errors.
- `image-preview.tsx`: use `next/image` for migrated Core UI preview, removing one direct migrated-UI image warning.

## Coverage by primitive category

- Contracts and compatibility: covered; `core-contracts.test.tsx` green (11/11).
- Theme and responsive foundation: covered; `theme.test.tsx` green (8/8).
- Overlay and feedback: covered; overlay, dialog-session, toast tests green.
- Data display and navigation: covered; data primitives, table model, tabs, accordion tests green.
- Forms, money, dates, and upload: covered; form/upload, VND, date, phone tests green.
- Shell and route compositions: covered; shell, manager route/layout, motel selection/navigation tests green.
- Capture/offline sync: covered; queue, sync, service-worker tests green.
- API/client primitives: covered; client, server, endpoint, fixture, renter API tests green.
- Playwright browser interaction and responsive QA: not covered; environment blocker above.

## Gate decision

Core UI source/test gate is green for typecheck, lint errors, Vitest, and production build. Playwright remains blocked only by missing Chromium executable. No unrelated files changed.
