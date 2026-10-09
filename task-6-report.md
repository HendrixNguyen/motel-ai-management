# Task 6 report

## Scope
- Added AppShell, ManagerShell, PortalShell, MotelSwitcher, BottomNav compositions.
- Migrated manager and renter layouts to compositions without changing auth or data loading.
- Preserved five manager destinations and motel query scope.
- Added shell unit coverage for composition, accessibility labels, safe-area class, and mobile navigation.

## Verification
- Focused shell Vitest: pass, 9 tests.
- Frontend typecheck: pass.
- Frontend ESLint: pass.
- Full Vitest: existing unrelated theme failures in `src/components/ui/__tests__/theme.test.tsx` (3 failures).
- Next build: blocked by existing generated `.next/dev/types/validator.ts` route type errors.
- Playwright not run; browser dependency blocker documented in AGENTS.md.

## Unrelated failures
- Theme test expects prior theme implementation behavior and CSS safe-area literal.
- Build fails in generated Next route validator types, outside Task 6.

## Review follow-up
- Compact mobile billing label now renders `Hóa đơn`; full accessible name remains `Tính tiền & Hóa đơn`.
- Navigation links expose explicit accessible labels and retain `?motel=` scope.
- Added unit assertions for compact label, scoped billing href, fixed-nav class, and shell safe-area class.
- Playwright shell command attempted for `chromium-mobile`; all 13 tests failed during browser launch because Debian Chromium dependencies are unavailable (`libnspr4.so` and related libraries). No browser assertions executed.
- Viewport verification limitation: 360/375/430 cannot be measured until Playwright browser dependencies are installed. Existing CSS uses responsive/fixed layout and unit coverage confirms required shell classes only.
- Backend files were not modified.
