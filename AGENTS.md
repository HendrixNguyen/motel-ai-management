# Motel Management — Agent Notes

Vietnamese motel (nhà trọ) rental and utility billing. A manager reads two meters per room;
the system produces itemised invoices; renters get a Zalo message with a link to a mobile
portal to see the arithmetic, pay by VietQR, sign their contract, and report problems.
Product context: `README.md`.

## Repo shape

- Two independent Bun packages. **There is no root `package.json` and no workspace file** —
  run `bun install` inside `backend/` and `frontend/` separately; each has its own
  `bun.lock`. No root-level `bun install`, `bun test`, or `bun run build` exists.
- `backend/` — ElysiaJS + Drizzle + PostgreSQL, wired through `src/app.ts` → `src/index.ts`.
- `frontend/` — Next.js 16.3.8 App Router. The root layout and the design tokens in
  `src/app/globals.css` are in place; there is no `src/app/page.tsx` yet, so `/` is a 404 until
  a route group claims it. The manager / renter / capture route groups are specified in
  `docs/frontend-ui-specs.md` but not implemented yet.
- Bun only. Never `npm`, `yarn`, or `npx`.
- Git remote is **SSH**: `git@github.com:HendrixNguyen/motel-ai-management.git`. HTTPS push
  fails on this machine — there is no working credential prompt path.
- `.kilo/worktrees/fish-steed` is a stale Agent Manager checkout pinned to an old commit. It
  is not the working tree; never edit files there.

## Commands

```bash
# backend
cd backend
bun run dev                 # --watch src/index.ts, PORT (default 3000)
bun run typecheck           # tsc --noEmit
bun test                    # everything; needs a live PostgreSQL, see below
bun test src/test/money.test.ts   # one file — the only clean way to isolate from the DB
bun test -t "test name"           # name filter — still loads every test file
bun run db:generate && bun run db:migrate
bun run db:studio

# frontend
cd frontend
bun run dev                 # next dev -p 3001; 3000 is the backend's PORT
bun run lint                # eslint, silent when clean
bun run build
bun run typecheck           # tsc --noEmit
bun run test                # vitest run — unit tests under src/
bun run test:e2e            # playwright  — e2e/**/*.spec.ts, fixture-backed
```

The frontend harness: `vitest.config.mts` collects `src/**/*.test.ts` only, and `playwright.config.ts`
declares two projects — `chromium-mobile` (375x667, every `**/api/**` answered by a fixture in
`e2e/fixtures/api.ts`, so **no database and no backend process are needed**) and `real-stack`
(`e2e/real/**`, filtered out unless `E2E_REAL=1`). The two runners never overlap: Vitest's include
is rooted at `src/`, Playwright's `testMatch` at `e2e/`. `docs/testing-strategy.md` owns what each
layer must test.

`bun run test` runs anywhere the dependencies install. `bun run test:e2e` additionally needs a
browser that can start, which on a minimal Linux image needs a one-time
`sudo bunx playwright install-deps chromium`; see the "Known state" section below.

Verify in this order: backend `typecheck` → `test`; frontend `typecheck` → `lint` → `build` →
`test` → `test:e2e`.

## The local database (this is where the time goes)

- Backend tests hit a **real PostgreSQL**, not a mock: `TEST_DATABASE_URL` from
  `backend/.env`. `src/db/index.ts` points its only pool at that URL when `NODE_ENV=test`,
  and there is no second client export, so a test cannot reach the dev database.
- **`bun test` loads every test file even when all of them are filtered out.** The database
  is therefore required for *any* `bun test` run, not just integration tests — without it you
  get `connect ECONNREFUSED 127.0.0.1:5432` plus one bogus failure. Pass an explicit file path
  (`bun test src/test/money.test.ts`) to run a pure test cleanly.
- `docker-compose.yml` provides postgres 16 and `scripts/init-db.sql` creates `motel_test`.
  **Its credentials disagree with `.env.example`**: compose sets `POSTGRES_PASSWORD=password`
  while `.env.example` uses `postgres:postgres`. Align them or authentication fails.
  A postgres 16 container is running on this machine (`motel-postgres`, reachable on
  `127.0.0.1:5432`), so backend tests can run — but do not assume it: probe
  `TEST_DATABASE_URL` first, and report `ECONNREFUSED` as blocked rather than as passing.
- **One `bun test` at a time.** `resetDb()` drops and recreates the `public` and `drizzle`
  schemas, so a second run against the same database interleaves `DROP`/`CREATE` with the
  first. The resulting errors look like real defects but are cross-talk:
  `duplicate key value violates unique constraint "pg_namespace_nspname_index"` on
  `CREATE SCHEMA public`, and `schema "drizzle" does not exist` from the migrator. `bun test`
  with no file argument is also affected, because it runs files in parallel against one
  database. Pass an explicit file path, and check no other session is testing first.
- `resetDb()` (`src/db/test-db.ts`) drops the `public` and `drizzle` schemas, re-applies every
  migration, then truncates a **hardcoded `TABLES` list**. Adding a table means adding it
  there too, or rows leak between tests. It refuses to run unless the pool is provably on
  `TEST_DATABASE_URL`.
- `src/config.ts` parses and freezes the environment **at import time**, and `src/env.ts`
  throws if a var is missing or a secret is shorter than 32 chars. One missing
  `backend/.env` entry breaks every test, not just the server.
- `.env.example` is the only committed env file. Generate secrets with
  `openssl rand -base64 48`.

## Backend architecture

Modular monolith (ADR-0004). Each domain under `backend/src/modules/<domain>/` owns
`<domain>.route.ts`, `<domain>.service.ts`, `<domain>.schema.ts`, `<domain>.types.ts`.

- Cross-module calls go through the other module's **exported service functions**, never by
  importing its tables. No compiler or lint rule enforces this yet.
- `src/db/schemas.ts` may only **re-export** module tables — drizzle-kit reads it for the
  full schema. It is not an import target for application code.
- `src/shared/` is for genuinely cross-cutting code (money, phone, error taxonomy). Domain
  logic there means the module was never created.
- `@/*` maps to `src/*` in `tsconfig.json` but **not** in `drizzle.config.ts`: drizzle-kit
  bundles that file without the alias, so it reads `process.env.DATABASE_URL` and throws when
  it is missing.
- `createApp()` returns a fresh Elysia instance; `app` is the one the server listens on.
  Tests build their own so a throwing route can be registered without a test-only route
  existing in production code.
- The browser reaches the backend through a **same-origin rewrite proxy**: `next.config.ts`
  rewrites `/api/:path*` onto `${BACKEND_URL}/api/:path*` (ADR-0008), so every request carries
  the host-only `httpOnly` session cookie and production CORS stays `origin: false`. Browser
  code calls relative `/api/...` and is never given a base URL. `BACKEND_URL` is server-only —
  do not give it a `NEXT_PUBLIC_` prefix, and do not add an origin allowlist to make a browser
  call succeed.

## Conventions that differ from the defaults

- **Money is never a float.** VND crosses HTTP as a JSON string of digits (`"3850000"`) and is
  computed with `parseVnd` / `sumVnd` / `formatVnd` in `src/shared/money.ts` (BigInt).
  Storage is `numeric(14,0)` for amounts, `numeric(12,2)` for meter usage.
- **User-facing text is Vietnamese, codes are English.** `AppError` messages are written for
  the renter to read. `ErrorCode` is the stable machine identifier, enumerated once in
  `src/shared/errors.ts`.
- Error envelope is `{ error, code, details? }`, `details` omitted unless it helps the caller.
  Unexpected errors are logged and reported as `INTERNAL_ERROR`; a driver message or database
  URL must never reach a client.
- Tenant scope always comes from the session; no endpoint accepts a `managerId` from the
  client. Cross-tenant denial is **404, never 403** — a 403 confirms the resource exists.
- UUID primary keys, `timestamptz` with `now()` defaults, `snake_case` columns mapped by
  Drizzle. Backend also sets `noUncheckedIndexedAccess`; both packages are strict TypeScript.
- Frontend imports use `@/*` → `frontend/src/*`.
- `docs/superpowers/plans/` holds the current sub-project plan; work proceeds in the eight
  sub-projects listed in `README.md`, one plan written just before its sub-project is built.

## Testing

`docs/testing-strategy.md` is the contract. The parts that bite:

- Every `UNIQUE`, `CHECK`, and partial unique index gets a test that tries to violate it and
  asserts PostgreSQL refuses. A constraint enforced only in route validation is unenforced.
- Tenant scoping is tested **over HTTP** through `app.handle(new Request(...))` with a real
  session cookie and a real foreign id, in both directions.
- A behaviour change without a test is an unfinished change.
- A test that cannot fail is worse than no test — delete it and write a real one.
- Tests live in `backend/src/test/*.test.ts`.

## Docs are part of the change

These are the project's memory. Code follows them; when a change forces a document to change,
they change in the same commit.

| Document | Owns |
|----------|------|
| `docs/superpowers/specs/2026-10-03-motel-management-design.md` | Data model, flows, security rules, build order |
| `docs/api-contract.md` | Endpoints, request/response bodies, error codes |
| `docs/frontend-ui-specs.md` | Screens, states, badges, copy |
| `docs/testing-strategy.md` | What must be tested and at which layer |
| `docs/adr/` | Decisions that were argued or that add a dependency |
| `backend/.env.example` | Backend env var names, with honest placeholders |
| `frontend/.env.example` | Frontend env var names, with honest placeholders |

- State a fact once, in the document that owns it. Link from the others; do not restate.
- Changing a table → design spec, plus the API contract if the field is exposed over HTTP,
  plus `.env.example` if it adds a variable, plus the `TABLES` list in `src/db/test-db.ts`.
- Changing a status, enum, or error code → the design spec, the UI badge table, the API
  contract, and `src/shared/errors.ts` must all agree before the change is complete.
- No `TBD`, no unfinished sections, no requirement that can be read two ways. Placeholders are
  allowed only in `.env.example`, where the placeholder is the honest state of a value Zalo or
  Cloudflare has not issued yet.
- New third-party dependency → new ADR.

## Review before merging

| Command | Agent | Use for |
|---------|----------|---------|
| `/review-security` | `security-reviewer` | auth, tenancy, uploads, money, Zalo webhook |
| `/review-code` | `code-reviewer` | ADR-0004 boundaries, spec conformance, types, tests, doc drift |

Both are read-only, report `file_path:line_number` with severity, and treat a missing test as
a finding. **Both review uncommitted changes only** (`git diff` plus untracked files), so run
them before committing or the reviewer sees an empty diff.

## Known state as of 2026-10-05

- `cd backend && bun run typecheck` **passes**. The `.onNotFound()` failure it used to report
  is gone as of `40355da`; ElysiaJS 1.4 has no `.onNotFound()` at all, so do not reintroduce
  one, and do not downgrade the dependency to hide a type error.
- Because dependencies are `"latest"`, a `bun install` can change behaviour under you. Check
  the installed version before trusting framework behaviour.
- `frontend/AGENTS.md` is generated by `next dev` (Next 16.3.8 differs from training data).
  Read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing Next code,
  and leave that block in the file.
- **Playwright's browser downloads, but this Debian image cannot launch it without root.**
  `bunx playwright install chromium` succeeds; Chromium then dies with
  `error while loading shared libraries: libnspr4.so` and ~16 more (`libnss3`, `libatk-1.0`,
  `libgbm`, `libasound`, the `libX*` set). **Cure, once per machine, needs sudo:**
  `sudo bunx playwright install-deps chromium`. There is no passwordless sudo on this box, so
  `bun run test:e2e` fails at browser launch until someone runs it. That is a missing OS package,
  not a harness defect — `bun run test` and `bun run build` are unaffected. Report the launch
  failure; do not work around it in the repo.
