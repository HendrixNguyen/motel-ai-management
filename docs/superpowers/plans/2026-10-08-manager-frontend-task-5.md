# Manager Frontend Task 5 — Login, Shell, Motel Selection

- **Date:** 2026-10-08
- **Scope:** Manager frontend Task 5 only: login, protected manager shell, URL motel selection, responsive navigation, session guard, loading/error/not-found states, tests, and verification.
- **Product scope:** Existing manager API-backed routes only: `/`, `/motels`, `/rooms`, `/renters`, `/renters/[renterId]`. No billing, contracts, tickets, settings, renter portal, backend changes, or new dependencies.
- **Source documents:** `docs/frontend-ui-specs.md` §2; `docs/api-contract.md` §Auth and manager endpoints; `docs/superpowers/plans/2026-10-05-manager-frontend-foundation.md` Task 5; `AGENTS.md`; current `frontend/` implementation.

## Audit baseline — existing implementation

Treat current code as audit baseline, not assumed-complete implementation. Do not overwrite unrelated work. Current files already present:

- `frontend/src/app/(auth)/login/page.tsx`: client login form, Vietnamese field/form errors, `router.replace("/")`, `router.refresh()`.
- `frontend/src/app/(manager)/layout.tsx`: cookie pre-check, parallel `getMe()`/`listMotels()`, `redirect("/login")` path, skip-link, shell composition, `Suspense` around `TopBar`, `ToastProvider`.
- `frontend/src/components/manager/sidebar.tsx`: four implemented destinations only; desktop 240px sticky sidebar and four-item mobile bottom nav.
- `frontend/src/components/manager/top-bar.tsx`: URL motel selector, current-path/query preservation, logout, no-motel disabled state, account menu.
- `frontend/src/lib/motel-selection.ts`: absent motel falls back to first owned motel; foreign/repeated/non-string motel calls `notFound()`.
- `frontend/src/lib/motel-navigation.ts`: preserves query parameters while setting `motel`.
- `frontend/src/app/(manager)/loading.tsx`, `error.tsx`, `not-found.tsx`, `frontend/src/app/error.tsx`, and `frontend/src/app/not-found.tsx`: existing route boundaries/states to audit against copy, retry, reset, accessibility, and route scope.
- Existing tests: `frontend/src/lib/__tests__/manager-layout.test.ts`, `frontend/e2e/shell.spec.ts`, plus API fixture helpers under `frontend/e2e/fixtures/`.

Audit must happen before edits. Preserve correct behavior; close only verified gaps.

## Gaps and risks to resolve

1. **Auth redirect behavior:** distinguish missing cookie, expired/invalid `/api/auth/me`, expired/invalid motel list, and login API failure. Server reads must forward `manager_session`; browser login/logout must use same-origin `/api` so `Set-Cookie` reaches browser. Avoid redirect loops for a manager with zero motels. Preserve intended post-login destination only if existing contract/tests support it; otherwise keep canonical `router.replace("/")`.
2. **Shell route scope:** nav must expose only implemented routes. Do not add deferred destinations from the full UI spec. Verify `/renters/[renterId]` remains shell-scoped even though it is not a primary nav destination.
3. **Stale docs:** the 2026-10-05 foundation plan describes work from an earlier scaffold and may conflict with current files. This plan is current Task 5 execution scope; reconcile implementation with `docs/frontend-ui-specs.md` and `docs/api-contract.md`, not stale assumptions.
4. **Accessibility:** labels must name controls; field errors must join existing descriptions; alerts/statuses need semantic live behavior; focus rings and 44px targets must remain; mobile nav and account menu must be keyboard reachable; not-found/error actions need clear names; no state may rely on color alone.
5. **Playwright browser blocker:** fixture-backed E2E does not require DB, but this machine lacks Chromium OS libraries (`libnspr4`, `libnss3`, `libatk`, `libgbm`, `libasound`, and X libraries). `bun run test:e2e` may fail at browser launch until `sudo bunx playwright install-deps chromium`; report as environment blocker, not product failure.
6. **Dirty worktree:** audit with `git status --short` before implementation and preserve unrelated files. Current planning checkout status was clean; future execution must not assume this. Never reset or clean unowned changes.

## Interfaces and invariants

### Auth

- Browser: `frontend/src/lib/api/auth.client.ts` exports `login(input: LoginInput)`, `logout()`. Calls relative `/api/auth/login` and `/api/auth/logout`; non-2xx throws `ApiError`.
- Server: `frontend/src/lib/api/auth.ts` exports `getMe(): Promise<ManagerMeResponse>`, using server fetch with forwarded `manager_session`; 401 redirects to `/login`.
- `frontend/src/lib/login-form.ts` owns `LoginFieldErrors`, `validateLogin(input: LoginInput)`, and `authenticateManager(input: LoginInput)`. Client validation stays field-level; API `VALIDATION_ERROR`/401 stays form-level.
- `frontend/src/app/(auth)/login/page.tsx` submits once while pending, focuses first invalid field, preserves form on failure, and replaces `/` after success.

### Motel scope

- `frontend/src/lib/motel-selection.ts`: `resolveMotelId(motels: readonly { id: string }[], searchParams: MotelSearchParams): string | undefined`. Absent `motel` returns first owned ID; valid owned ID returns itself; non-string, repeated, unknown ID calls `notFound()`; empty owned list returns `undefined`.
- `frontend/src/lib/motel-navigation.ts`: `motelHref(pathname: string, search: string, motelId?: string): string`; changes only `motel`, preserves other query keys and pathname.
- Every motel-scoped server page validates ownership before scoped reads. Selector switching reloads current route with new `?motel=`.

### Shell

- `frontend/src/app/(manager)/layout.tsx` remains async Server Component. It guards cookie before protected fetches, loads manager and owned motels in parallel, renders `Sidebar`, `TopBar`, and `ToastProvider`, and exposes `#main-content`.
- `frontend/src/components/manager/sidebar.tsx` owns the four supported primary destinations: `/`, `/motels`, `/rooms`, `/renters`. Desktop: `w-60`/240px sticky at `lg`; mobile: compact bottom nav with ≤5 links and labelled secondary menu supplied by top bar.
- `frontend/src/components/manager/top-bar.tsx` owns selector, account menu, logout, and pending/error state. Selector preserves pathname and all non-motel query params.
- `frontend/src/app/(manager)/loading.tsx` exposes a Vietnamese skeleton/status without harmful motion. `error.tsx` is a client boundary with Vietnamese error copy and `reset()`. `not-found.tsx` names missing page/motel state and offers a reachable navigation action.

## Execution order

1. **Preflight and ownership audit**
   - Read `AGENTS.md`, `frontend/AGENTS.md`, current Task 5 files, API client/server modules, tests, and relevant Next guide under `frontend/node_modules/next/dist/docs/`.
   - Run `git status --short`; record unrelated paths. Do not edit or delete them.
   - Compare behavior against this plan and `docs/frontend-ui-specs.md` lines 123–149 and `docs/api-contract.md` lines 13–19, 81–96.

2. **Lock auth transport and guard behavior**
   - Verify `frontend/src/lib/api/client.ts`, `auth.client.ts`, `server.ts`, `auth.ts` interfaces and no absolute browser API URL.
   - Fix only Task 5 gaps: cookie pre-check before fetch, 401 redirect consistency, login/logout route behavior, pending/error handling. Do not alter backend contract.
   - Keep zero-motel manager inside shell; selector disabled and overview/motel creation state remains reachable.

3. **Lock URL motel selection**
   - Audit all shell pages and `resolveMotelId` use.
   - Ensure absent selection normalization does not drop existing filters/query keys.
   - Ensure foreign motel IDs render route not-found, not a data leak or generic zero state.
   - Ensure selector changes current path only and retains unrelated search params.

4. **Audit responsive shell and accessibility**
   - Check desktop sidebar width/sticky behavior, mobile bottom nav, safe-area padding, no horizontal overflow at 360–375px, keyboard/focus order, labels, live regions, and 44px controls.
   - Keep four supported destinations only. Ensure secondary account menu is explicitly labelled and does not depend on hover.

5. **Audit route boundaries**
   - Confirm root `frontend/src/app/error.tsx` and `not-found.tsx` do not conflict with manager boundary states.
   - Confirm manager `loading.tsx`, `error.tsx`, `not-found.tsx` have stable Vietnamese copy, retry action, accessible status/alert semantics, and no secret/error leakage.

6. **Add/adjust focused unit tests**
   - `frontend/src/lib/__tests__/manager-layout.test.ts`: anonymous cookie guard makes zero fetches; `/me` 401 redirects; motel list 401 redirects; forwarded cookie and `cache: "no-store"`; valid manager loads both resources; zero-motel manager renders without redirect loop.
   - Add/extend `frontend/src/lib/__tests__/login-form.test.ts`: invalid email/password blocks request; API 401 preserves form-level message; success returns `{ ok: true }`.
   - Add/extend `frontend/src/lib/__tests__/motel-selection.test.ts`: absent → first; empty list → undefined; owned selection; foreign/repeated/non-string → `notFound`; `motelHref` preserves path and unrelated params.
   - Keep tests deterministic; no DB, no real backend, no secrets.

7. **Add/adjust fixture-backed Playwright tests**
   - `frontend/e2e/shell.spec.ts`: unauthenticated `/rooms` → `/login`; successful login stores httpOnly session and lands on `/?motel=<first>` or canonical `/` per audited behavior; 401 login stays on `/login`; motel switching preserves path/other params; absent motel normalizes; foreign motel shows Vietnamese not-found; expired `/me` and motel reads redirect; zero motels do not loop; logout clears cookie; mobile links keyboard reachable and no horizontal scroll; desktop sidebar is 240px sticky.
   - Use `frontend/e2e/fixtures/api.ts` only. Do not add real-stack coverage for this task.

8. **Verify and report**
   - Run in order: `cd frontend && bun run typecheck`; `bun run lint`; `bun run build`; `bun run test`; `bun run test:e2e`.
   - If E2E cannot launch Chromium, capture exact blocker and report unit/build status separately; do not change repo to bypass it.
   - Re-run `git status --short`; confirm only intended Task 5 files changed.

## Acceptance tests

- Anonymous request to any manager route redirects to `/login` before protected data fetch.
- Invalid login fields show associated Vietnamese errors and no network login request.
- API login failure keeps form and shows form-level Vietnamese error; success uses proxied cookie and reaches overview.
- Expired session from either protected server read redirects to `/login`; no redirect loop when owned motel list is empty.
- Motel selector is global URL state: preserves pathname and unrelated query params, changes only `motel`, and causes current route to reload.
- Missing motel selects first owned motel; unknown/foreign/repeated motel value renders not-found; no foreign data fetch occurs.
- Desktop shell has 240px sticky sidebar; mobile shell has four reachable primary links plus labelled secondary menu; controls work by keyboard and meet 44px target.
- Loading state announces progress; error state offers retry; not-found state offers clear recovery; all text is Vietnamese and secrets/backend errors stay hidden.
- Frontend typecheck, lint, build, and Vitest pass. Playwright passes when Chromium dependencies exist; otherwise documented OS blocker only.

## Out of scope

Billing/invoice navigation, contract navigation, ticket navigation, settings navigation, renter portal, backend/API changes, persistent motel context, cookie-based motel selection, new UI frameworks, visual redesign beyond required Task 5 accessibility/responsive fixes, production deployment, and unrelated worktree cleanup.
