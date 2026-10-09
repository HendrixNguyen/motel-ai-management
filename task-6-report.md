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
- Mobile compact label and billing accessible name are scoped under `Điều hướng gọn trên điện thoại`; desktop navigation remains unchanged.
- Navigation links expose explicit accessible labels and retain `?motel=` scope.
- Focus-visible regression coverage now asserts button ring utilities and global `:focus-visible` outline declaration.
- Safe-area regression coverage now asserts exact `.shell-safe-area { padding-bottom: env(safe-area-inset-bottom); }` declaration.
- Playwright command attempted: `cd frontend && bun run test:e2e --project=chromium-mobile`.
- Exact Playwright blocker: `error while loading shared libraries: libnspr4.so` and ~16 more (`libnss3`, `libatk-1.0`, `libgbm`, `libasound`, the `libX*` set).
- Viewport verification limitation: 360/375/430 cannot be measured until Playwright browser dependencies are installed. Existing CSS uses responsive/fixed layout and unit coverage confirms required shell classes only.
- Frontend-only changes; backend files were not modified.
- Added regression assertion that billing link and full `aria-label` stay inside compact mobile nav subtree; desktop nav keeps `Tính tiền & Hóa đơn`.
- Focused test command unavailable: `bun: command not found`.
- Fixed Task 6 shell test regex single-escape bug; no backend changes.
