# Manager Frontend Foundation (Sub-project 5, Phase 1)

**Goal:** Build the manager app's foundation and the four screens the live API supports —
design tokens, component kit, typed API client, auth, responsive shell, and M1–M4. Nothing
ships broken: every screen is backed by an endpoint that exists.

**Path:** `frontend/` — Next.js 16.3.8 App Router, React 19.2.8, Tailwind CSS v4.3.3,
TypeScript strict. Today it is a pristine `create-next-app` scaffold: one placeholder route,
no API client, no components, no tokens, no test runner.

**When executed, commit this plan to `docs/superpowers/plans/` per `AGENTS.md`.**

---

## 1. Scope

`docs/frontend-ui-specs.md` covers three sub-projects (manager / capture / renter), not one.
This plan is manager-only, and only the part the backend can serve.

| In scope | Deferred — no API exists |
|---|---|
| Token system, component kit, format utils | M5 billing, M6 invoices — no `billing`/`invoice` route |
| Typed API client + server fetcher | M7 contracts, M7a templates — no `contract` route |
| Auth: login, logout, session guard | M8 tickets — `ticket.schema.ts` only, no service/route |
| Shell: sidebar, top bar, motel selector | M9 settings: Zalo status — no `zalo` module |
| M2 Nhà trọ (full) | M1's Doanh thu / Tiền chưa thu / Sự cố cards |
| M3 Phòng trọ (minus overdue, meter history) | M3 overdue indicator, meter history |
| M4 Khách thuê (minus "Gửi Zalo") | M4 "Gửi Zalo" — only `POST .../magic-link` exists |
| M1 Overview: Phòng card + live quick actions | |

**Deferred screens get no routes and no nav items.** A sidebar entry that 404s is a broken
affordance; the full 8-item sidebar ships when sub-projects 3, 4 and 8 land.

---

## 2. Decisions

| # | Decision | Rejected alternative |
|---|---|---|
| D1 | **Same-origin rewrite proxy.** `next.config.ts` rewrites `/api/:path*` → `${BACKEND_URL}/api/:path*`. Browser calls relative `/api/...` only. | Cross-origin + CORS allowlist. Cookies are `httpOnly`, `sameSite:"lax"`, host-only, `secure` in prod (`auth.route.ts:23-30`); a different-site origin is blocked twice over, and `app.ts:24` sets `origin:false` in production. |
| D2 | **`BACKEND_URL` is server-only** (no `NEXT_PUBLIC_` prefix). Read by `next.config.ts` and by server-side fetch only. | `NEXT_PUBLIC_API_BASE_URL` from `api-contract.md:4` — it would ship the internal URL to the browser and invite cross-origin calls that cannot carry the cookie. Retire it. |
| D3 | **Reads: React Server Components.** Mutations: client components POSTing to the proxied path. | Server Actions — need `Set-Cookie` forwarding for auth and add indirection; a relative browser POST sets the cookie directly and is the smaller, more legible mechanism. |
| D4 | **Motel selection lives in the URL** as `?motel=<uuid>` on `/`, `/rooms`, `/renters`, `/renters/[renterId]`. Absent → `router.replace` to the first motel; id not owned by the manager → `notFound()`. | Cookie or React Context — neither is server-readable, so RSC cannot scope its fetch, and Context forces client rendering of every screen. URL state also satisfies "switching motels reloads the current route against the new id" exactly. |
| D5 | **Hand-rolled kit on Tailwind v4 `@theme`** tokens. Native `<dialog>` for modal and drawer, `<details>` for accordion, a ~40-line toast context, a hand-rolled sortable table. | shadcn/ui + Radix — ~10 direct deps (each needs an ADR per `AGENTS.md`), a competing token layer to fight at every component, and its defaults are not the spec's 15-token table. `<dialog>` already supplies focus trap, Esc, inertness and top layer. |
| D6 | **`VndString = string`** in the frontend, with a runtime guard `parseVndDigits()` at the API boundary that rejects non-digits. `formatVnd` groups the digit **string** only — never parsed to `Number`. | Branded string — forces an `as` cast on every literal and fixture. |
| D7 | **Frontend types hand-written** in `src/lib/api/types.ts`, mirroring `docs/api-contract.md`. E2E fixtures are typed with them, so drift fails the typecheck when someone edits a fixture. | Importing backend `*.types.ts` — the frontend tsconfig does not resolve the backend's `@/*` alias, and the files reach `drizzle` schemas. |
| D8 | **Client-side validation owns field-level errors.** A server `VALIDATION_ERROR` renders as a form-level banner: `error-handler.ts:23-26` returns no `details`, so there are no field names to map. | `aria-describedby` per field from server errors — impossible with the current envelope. Fixing that is a backend task, tracked in D-doc below. |
| D9 | **Vitest + Playwright**, both added deliberately. Playwright defaults to `page.route('**/api/**')` fixtures; a second `real-stack` project (`testMatch: e2e/real/**`, gated on `E2E_REAL=1`) is written but cannot run until PostgreSQL exists. | Vitest-only — cannot verify the proxied cookie session, the 375px no-horizontal-scroll rule, or keyboard reachability. No runner — contradicts `testing-strategy.md`. |
| D10 | **M3 joins renters in memory.** The page fetches rooms and renters once each and indexes by `roomId`. `RoomResponse` carries no renter. | Adding `currentRenter` to `RoomResponse` — a backend + contract change for one screen's convenience. 2 requests total for 10–40 rooms, not N. |

---

## 3. Target layout

```
frontend/
  .env.example                     NEW   BACKEND_URL=http://localhost:3000
  next.config.ts                   EDIT  rewrites -> BACKEND_URL
  package.json                     EDIT  + typecheck script, vitest, @playwright/test
  playwright.config.ts             NEW   projects: chromium-mobile, real-stack
  vitest.config.ts                 NEW
  e2e/
    fixtures/api.ts                NEW   typed response fixtures
    manager.spec.ts                NEW   fixture-backed flows
    real/stack.spec.ts             NEW   E2E_REAL=1 only
  src/
    app/globals.css                EDIT  token block; delete dark-mode query
    app/layout.tsx                 EDIT  lang="vi", Be Vietnam Pro + Noto Sans
    app/(auth)/login/page.tsx      NEW
    app/(manager)/layout.tsx       NEW   session guard, me + motels, shell
    app/(manager)/loading.tsx      NEW
    app/(manager)/error.tsx        NEW
    app/(manager)/page.tsx         NEW   M1
    app/(manager)/motels/page.tsx  NEW   M2
    app/(manager)/rooms/page.tsx   NEW   M3
    app/(manager)/renters/page.tsx NEW   M4
    app/(manager)/renters/[renterId]/page.tsx  NEW  M4 detail
    components/ui/*.tsx            NEW   11 primitives
    lib/api/{types,client,server,auth,auth.client,motels,motels.client,rooms,rooms.client,renters,renters.client}.ts   NEW
    lib/format/{vnd,date,status}.ts NEW
    lib/format/__tests__/*.test.ts NEW
    lib/motel-selection.ts         NEW   read/validate ?motel=
docs/adr/0008-frontend-transport-same-origin-proxy.md   NEW
```

---

## 4. Tasks

Each task ends with its own acceptance check. Verify frontend in the order
`typecheck → lint → build → test`.

### Task 0 — Transport decision, doc reconciliation, and one backend fix

`AGENTS.md` requires docs to move in the same commit as the code they describe, and D1
(the rewrite proxy) is the transport every later task depends on. This task lands both first.

- [ ] `frontend/next.config.ts` — add `async rewrites()` returning
      `[{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }]`, reading
      `process.env.BACKEND_URL` with a `http://localhost:3000` default so a fresh clone runs.
      This is what makes a relative `POST /api/auth/login` (Task 5) reach the backend with the
      cookie intact, in dev and in production.
- [ ] `frontend/.env.example` (new file) — `BACKEND_URL=http://localhost:3000` and a note that
      it is **server-only**, never `NEXT_PUBLIC_`, and must be present at build time because
      `next.config.ts` is evaluated then.
- [ ] `docs/api-contract.md`: record the same-origin proxy decision; replace the
      `NEXT_PUBLIC_API_BASE_URL` line (`:4`) with server-only `BACKEND_URL`; state that list
      endpoints return **bare JSON arrays**; state that `VALIDATION_ERROR` carries no `details`
      unless the service sets it.
- [ ] `docs/api-contract.md:14` vs `:61` — magic-link exchange path contradiction. Canonical:
      `POST /api/renter/magic-links/exchange` with body `{ token }` (matches the code). Delete `:14`.
- [ ] `docs/superpowers/specs/2026-10-03-motel-management-design.md:531` — remove the
      403-for-wrong-tenant line. `:557-558` and `api-contract.md:17` say 404; 404 is correct.
- [ ] `docs/frontend-ui-specs.md` — annotate §2 with the deferred list from §1 of this plan;
      fix `:43-44` ("inside its due window") to match `:267` ("no due-date field").
- [ ] `backend/src/app.ts:17-19` — the comment says CORS is deliberately absent; `:24`
      registers it. Make the comment true (dev-only permissive, irrelevant in prod under D1).
- [ ] `AGENTS.md` — the "CORS is deliberately absent, and `frontend/next.config.ts` has no proxy"
      line is now false. Update it and add the frontend test commands.
- [ ] New ADR `docs/adr/0008-frontend-transport-same-origin-proxy.md`: problem, the three
      options considered, why cookies + production CORS ruled the cross-origin option out,
      the `BACKEND_URL`-is-server-only rule.
- [ ] **Backend bug fix (blocks M4):** `backend/src/shared/magic-link.ts:31` builds
      `/renter/${token}`. Both docs and the spec say the landing route is `/r/[token]`
      (`frontend-ui-specs.md:251`), so every magic link is dead. Fix the path; move
      `RENTER_PORTAL_URL` out of raw `process.env` into `env.ts` and `backend/.env.example`
      (currently undeclared anywhere, defaults to the backend's own port 3000).
- [ ] Retire the inert `NEXT_PUBLIC_API_BASE_URL` line in `backend/.env.example` (no backend
      code reads it; a `NEXT_PUBLIC_` var would ship the internal URL to the browser).

### Task 1 — Token system and root layout

- [ ] `globals.css`: `@import "tailwindcss"` then a `@theme` block defining
      `--color-{primary,primary-strong,success,success-bg,warning,warning-bg,danger,danger-bg,text,text-body,text-muted,border,surface,canvas}`,
      `--font-heading`, `--font-sans`, `--radius-input: 8px`, `--radius-card: 12px`.
      Map each spec value (`frontend-ui-specs.md:29-41`) **verbatim**. Delete the scaffold's
      `prefers-color-scheme: dark` block — the spec defines no dark palette.
- [ ] `layout.tsx`: `lang="vi"`, `metadata.title` in Vietnamese, Be Vietnam Pro via
      `--font-heading` and Noto Sans via `--font-sans`, both with
      `subsets: ["vietnamese", "latin"]` — **without the `vietnamese` subset the diacritics
      render as tofu**. Remove the Geist imports.
- [ ] Delete the placeholder `page.tsx` body.
- [ ] Check: `bun run build` succeeds; a scratch page renders `3.500.000 ₫` in Noto Sans with
      Vietnamese diacritics.

### Task 2 — Test harness scaffolding

Runs before the first task that writes a test. Installing the runner here is what lets Tasks 3,
4 and 5 verify their own work instead of shipping untested.

- [ ] Add `vitest` + `@playwright/test` as devDependencies with `bun add -d`. Scripts:
      `"typecheck": "tsc --noEmit"` (frontend has none today), `"test": "vitest run"`,
      `"test:e2e": "playwright test"`.
- [ ] `vitest.config.ts` — include `src/**/*.test.ts` only. Exclude `e2e/**`.
- [ ] `playwright.config.ts`: `chromium-mobile` at 375×667 running `e2e/**/*.spec.ts`;
      `real-stack` with `testMatch: "e2e/real/**"`, skipped unless `E2E_REAL=1`.
- [ ] `e2e/fixtures/api.ts` — a helper that intercepts `**/api/**` and serves fixtures typed
      with `lib/api/types.ts`. Task 4 creates those types; until then type the fixtures
      `unknown` and tighten them in Task 11.
- [ ] Prove the harness before building on it: one `src/lib/format/smoke.test.ts` and one
      `e2e/smoke.spec.ts` that must both pass with `bun run test` and `bun run test:e2e`.
      **No database and no backend process are needed** — that is the point of the fixture route.
- [ ] Do NOT run `playwright install` for browsers beyond chromium; if the browser download
      fails, `bun run build` and `bun run test` must still pass and you report it.

### Task 3 — Format utilities (the spec's hardest rules live here)

- [ ] `lib/format/vnd.ts` — **owns and exports `VndString`** (`= string`, documented as always
      digits; D6). `lib/api/types.ts` re-exports it rather than declaring a second one.
      `parseVndDigits(input): VndString | null` (strip `.`/spaces, reject anything non-digit,
      reject `""`); `formatVnd(digits): string` → `3.500.000 ₫` grouping the **string**, never
      `Number`; `formatVndPlain(digits)` for editable fields.
- [ ] `lib/format/date.ts`: `formatDate(iso) → DD/MM/YYYY` and `formatMonth(y, m) → MM/YYYY`,
      both resolved in `Asia/Ho_Chi_Minh`. No due-date formatter exists — deliberately.
- [ ] `lib/format/status.ts`: `roomStatusLabel`, `renterStatusLabel`, `oaFollowerLabel`
      (`Đã follow` / `Chưa follow`).
- [ ] Vitest: `formatVnd("3850000") === "3.500.000 ₫"`; `formatVnd("0") === "0 ₫"`;
      grouping never touches `Number` (a 14-digit `numeric(14,0)` value round-trips exactly);
      `parseVndDigits("3.500.000") === "3500000"`; `parseVndDigits("abc") === null`;
      `formatDate` crosses the UTC+7 day boundary correctly; labels map all enum values.

### Task 4 — Typed API client

- [ ] `lib/api/types.ts` — mirror `MotelResponse`, `RoomResponse`, `RenterResponse`,
      `RenterDetailResponse`, `BankAccountInput`, `MotelFeeInput`, `ListRoomsFilters`,
      `ListRentersFilters`, the two auth responses, and `ApiErrorBody { error, code, details? }`.
      `VndString` is **re-exported from `lib/format/vnd.ts`**, which Task 3 owns — do not
      redeclare it here. Match the **code**, which is self-consistent here — unlike
      `docs/api-contract.md`.
- [ ] `lib/api/client.ts` (browser): `apiGet`/`apiSend` against relative `/api/...`; non-2xx
      → throw `ApiError { status, code, message }`; guard every money field through
      `parseVndDigits` on the way in.
- [ ] `lib/api/server.ts` (RSC only): read `cookies()`, forward the `cookie` header, fetch
      `${BACKEND_URL}${path}` with `cache: "no-store"`; on 401 `redirect("/login")`.
- [ ] `lib/api/{motels,rooms,renters,auth}.ts` — one function per endpoint, no URL strings
      leaking into components.
- [ ] Vitest: each response fixture assigned to its `*Response` type, so a shape change breaks
      the build rather than the screen.

### Task 5 — Shell, auth, motel selection

- [ ] `app/(auth)/login/page.tsx` — client component; `POST /api/auth/login` to the proxied
      path so the browser stores `manager_session` itself; `router.replace("/")` on success;
      inline Vietnamese error on 401; label + `aria-describedby` wired per `Field`.
- [ ] `lib/motel-selection.ts` — `resolveMotelId(motels, searchParams)`: absent → first motel;
      present but not owned → `notFound()`.
- [ ] `app/(manager)/layout.tsx` — server component. No `manager_session` cookie →
      `redirect("/login")`. Fetch `/auth/me` + `/manager/motels`; 401 → redirect.
- [ ] Sidebar (server): **only the 4 implemented destinations**; 240px sticky at ≥1024px.
      Phones: compact nav at the bottom, ≤5 destinations, plus a labelled secondary menu.
- [ ] Top bar (client, inside `<Suspense>` — `useSearchParams` needs a boundary):
      motel `<select>` that preserves the current pathname and swaps `?motel=`; manager menu
      with logout (`POST /api/auth/logout` → `router.replace("/login")`).
- [ ] `loading.tsx` (skeleton), `error.tsx` (Vietnamese, retry), `not-found.tsx`.
- [ ] Playwright: unauthenticated `/rooms` redirects to `/login`; login lands on `/`;
      switching motel in the selector keeps the pathname and changes `?motel=`.

### Task 6 — Component kit

- [ ] `Button` — variants primary/secondary/ghost/danger; every size `min-h-11` (44px);
      visible `focus-visible` ring; disabled + pending states.
- [ ] `Field` — label + control + error, joined by `aria-describedby`, `aria-invalid` on error.
- [ ] `Modal` / `Drawer` — native `<dialog>`; focus returns to the trigger on close.
- [ ] `Badge` — tone prop mapped to the spec's tokens **plus** a text label. Never colour alone.
- [ ] `StatCard`, `EmptyState` (copy names the next action), `Skeleton`, `CopyButton`,
      `FilterBar`, `DataTable` (sort + paginate + search, reflows to rows under 640px),
      `Toast` provider.
- [ ] `TruncatedText` — one line, `title`, and the full value in `sr-only` + `aria-label`.
      `title` alone is tooltip-only and the spec forbids that.
- [ ] Every primitive honours `prefers-reduced-motion`; money cells are `tabular-nums`.

### Task 7 — M2 Nhà trọ `/motels`

- [ ] RSC grid: name, address, room count (from `GET /rooms` per motel — one call per card is
      acceptable at 10–40 rooms; note if it grows), electricity/water unit price, bank account
      name. Prices and money via `formatVnd`.
- [ ] Create + edit modals (`POST`/`PATCH /manager/motels`); the edit modal also carries
      `otherFees` (name + amount rows) and `bankAccount` — this is the settings surface the API
      actually supports today, so M9's prices/fees/bank section is delivered here instead.
- [ ] `409` → inline banner; `404`/`VALIDATION_ERROR` handled per D8.
- [ ] Empty state: "Chưa có nhà trọ — bấm **Tạo nhà trọ** để bắt đầu".

### Task 8 — M3 Phòng trọ `/rooms?motel=`

- [ ] Filter bar: floor, status (`Trống` / `Đang ở` / `Bảo trì`), name search → query params on
      the route, so filters are shareable and survive reload. Feeds `ListRoomsFilters`.
- [ ] Room card: name `P.101`, floor, **base price**, status badge, current renter name + phone
      joined in memory (D10). **No overdue indicator** — no invoice endpoint.
- [ ] Add/edit modal: Tên phòng, Tầng, Giá thuê cơ bảc. **No amenities field** (spec non-goal).
      Base price is entered as digits and previewed with `formatVndPlain` → `formatVnd`.
- [ ] Actions wired: edit, change status. "Xem khách thuê" links to `/renters?roomId=`.
      **No meter history** — omit the action.
- [ ] Duplicate name → `409` shown inline against the name field is not possible (D8), so it
      renders as a form-level banner naming the conflict.

### Task 9 — M4 Khách thuê `/renters?motel=`

- [ ] `DataTable`: Họ tên, SĐT, Số CCCD, Phòng, Trạng thái Zalo OA, Ngày bắt đầu, actions.
      Reflows to stacked rows under 640px — no horizontal page scroll at 360px.
- [ ] Detail `/renters/[renterId]`: personal info; CCCD front/back **only when URLs are
      present**, otherwise the "chưa cập nhật" placeholder; active contract summary from
      `activeContract` (`null` → an honest empty state, not a fake object); invoice history
      from `invoices` (`[]` today).
- [ ] Actions: **Tạo magic link** → `POST .../magic-link`, show the returned `url` in a
      `CopyButton`, with the corrected `/r/[token]` path (Task 0). **No "Gửi Zalo" button** —
      no endpoint exists.
- [ ] Phone shown via `formatPhone`-equivalent (`84XXXXXXXXX` → `+84 …`) with a copy button.

### Task 10 — M1 Overview `/`

- [ ] Phòng card: total rooms + `X đang thuê · Y trống · Z bảo trì` + occupancy %, from the
      room list and its status enum.
- [ ] Quick actions with live destinations only: **Thêm khách thuê** → `/renters`. **Chốt số
      điện/nước** and **Tạo hóa đơn** are omitted, not stubbed.
- [ ] The three deferred cards are absent. Do not render their widgets as zero-filled — a
      "Doanh thu dự kiến 0 ₫" tile would be a lie about data that does not exist yet.

### Task 11 — End-to-end specs (fixtures, then the gated real stack)

- [ ] `e2e/manager.spec.ts` — login → shell; each of M1–M4 renders; create/edit a room and a
      renter; empty state; error state from a 500; `409` banner; logout.
- [ ] Spec-derived assertions: no horizontal page scroll at 375px
      (`documentElement.scrollWidth <= clientWidth`); money cell never wraps; status badges
      expose text; every action reachable by keyboard; focus ring not clipped by the sticky
      header.
- [ ] `e2e/real/stack.spec.ts` — same login flow against a live backend. Written; **cannot run
      on this machine** (no Docker, no local PostgreSQL — `AGENTS.md` records
      `connect ECONNREFUSED 127.0.0.1:5432`). It is gated, not silently skipped.

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| No PostgreSQL / Docker on this machine | Fixture-backed Playwright + Vitest are fully runnable. Real-stack suite is written and gated, not silently absent. Backend `bun test` and real-stack E2E stay blocked — stated, not hidden. |
| `bun run typecheck` in `backend/` already fails on uncommitted work (`elysia` pinned `"latest"` resolves 1.4.30; `app.ts` uses `.all("*")`, `error-handler.ts` `set: any`) | Pre-existing. Do not downgrade the dependency to hide it. Task 0 touches `app.ts` — comment only. |
| `params`/`searchParams` are Promises in Next 16 | Every page awaits them. Asserted by the build. |
| `useSearchParams()` in the top bar | Wrapped in `<Suspense>`; all manager pages are dynamic via `cookies()`. |
| `BACKEND_URL` is read in `next.config.ts` at build time | Document in `frontend/.env.example`; must be present at build, not only at runtime. |
| `numeric(14,0)` money arriving as a JS number | `parseVndDigits` guard at the API boundary; `formatVnd` never parses to `Number`. |
| Backend types could drift from `docs/api-contract.md`, which self-contradicts on at least 3 points | Hand-write against the **code**; Task 0 fixes the doc; typed fixtures make drift a compile error. |
| Fonts without the `vietnamese` subset render diacritics as tofu | `subsets: ["vietnamese", "latin"]`, checked in Task 1. |

---

## 6. Validation

Frontend, in this order:

```bash
cd frontend
bun run typecheck        # tsc --noEmit          (new script)
bun run lint
bun run build
bun run test             # vitest
bun run test:e2e         # playwright, fixture-backed — no database needed
```

Backend (Task 0 touched `magic-link.ts`, `env.ts`, `app.ts`):

```bash
cd backend
bun run typecheck        # known-failing pre-existing; confirm no NEW errors
bun test src/test/renter-auth.test.ts    # magic-link path change touches this
```

Blocked on this machine: `bun test` (full suite), `bun run test:e2e` with `E2E_REAL=1`.
Report them as blocked with the evidence, not as passing.

Manual walkthrough at 375px: no horizontal scroll on any screen; every sidebar item is one of
the 4 implemented routes; money never wraps or truncates; the login round-trip works through
the proxy.

Before merging: `/review-security` (auth, cookie handling, the proxy's blast radius) and
`/review-code` (ADR-0004 boundaries, spec conformance, doc drift).

---

## 7. Out of scope / open

**Explicitly out of scope:** capture PWA (sub-project 6), renter portal (sub-project 7), Zalo
(sub-project 8), billing/invoice/contract/ticket endpoints, CORS allowlist, a frontend theme
switcher, i18n library (Vietnamese only, copy inline per the non-goals), drag-reorder clause
builder (belongs to contract templates), QR rendering (belongs to M6/R2).

**Open, needs a backend decision later — not blocking this plan:**

1. `VALIDATION_ERROR` returns no `details.fields`, so field-level server errors are impossible
   (D8). Either amend `api-contract.md` or extend the envelope. Task 0 amends the doc; the
   envelope change is a separate backend plan.
2. `GET /api/manager/motels/:motelId/renters/:renterId` composes contract + invoice summaries
   with no dedicated endpoints. Acceptable now; a manager-scale renter list may want pagination,
   which no endpoint supports.
3. Renter session TTL is 30 days in code, 24h in the spec. Untouched here.