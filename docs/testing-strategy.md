# Testing Strategy

- **Date:** 2026-10-03
- **Applies to:** `backend/` (Bun test) and `frontend/` (to be chosen when the first
  frontend test lands)

Tests are a deliverable, not a follow-up. A behaviour change without a test is an unfinished
change.

## The standard

| Layer | What it proves | Explicit assertions | When |
|-------|----------------|---------------------|------|
| Database constraints | The rule holds even when the API is bypassed | Invalid insert/update rejects; valid boundary value persists; no partial rows remain | Every new constraint |
| Service unit tests | The calculation or rule is correct | Each branch returns exact value, status, error code, and side effects; collaborator failure preserves required state | Every service function with a branch |
| HTTP boundary tests | Tenant scoping holds through a real request | Status, error envelope, response body redaction, and unchanged state match contract for own and foreign resources | Every route that filters by tenant |
| Pure-function tests | Money, phone, dates, formatting | Exact output for valid boundaries and exact rejection for malformed input | Once, then they never change |

### Database constraints are tested, not just declared

A constraint that exists only in the schema definition and only in a route's validation is
one refactor away from being unenforced. Every `UNIQUE`, `CHECK`, and partial unique index gets
a test that tries to violate it and asserts PostgreSQL refuses:

```ts
test("a meter cannot read lower than its previous reading", async () => {
  await seed();
  await expect(
    db.insert(meterReadings).values({ /* currentReading < previousReading */ }),
  ).rejects.toThrow();
});
```

### Tenant scoping is tested over HTTP, not at the service layer

A service function that takes `managerId` as a parameter can be called correctly in a test
while the route that calls it passes the wrong thing. The isolation tests must go through
`app.handle(new Request(...))` with a real session cookie and a real foreign id.

Both directions are required:

- manager A requesting manager B's motel → `404`, never `403`, never data
- renter B requesting renter A's invoice → the renter's own empty result, never renter A's

The `404`-not-`403` rule is not cosmetic: `403` confirms the resource exists, which tells a
competitor how many motels a rival runs.

### A test that cannot fail is not a test

Before committing, read the assertions and ask what input would make them fail. A test with no
assertion, an assertion that holds for any value, or a service whose only collaborator is the
function under test, proves nothing. If you cannot describe the failure it catches, delete it
and write a real one.

## Test database

Integration tests run against a real PostgreSQL database, not a mock — a mock cannot enforce
a `CHECK` constraint, so it cannot test the thing most likely to break.

- URL comes from `TEST_DATABASE_URL` in `backend/.env.example`
- `db/index.ts` points the pool at `TEST_DATABASE_URL` whenever `NODE_ENV=test`, which is
  what `bun test` sets. There is no second client export, so an integration test cannot
  reach the application database even by mistake
- `resetDb()` drops both the `public` and `drizzle` schemas, re-applies every migration,
  then truncates all tables in one statement. Re-applying matters: a test always runs
  against the current migration set, so a constraint added since the last run is enforced
  rather than silently absent
- `resetDb()` throws unless the pool is pointed at `TEST_DATABASE_URL`. It destroys a
  schema, and a real database must not be reachable from it

Never point `TEST_DATABASE_URL` at a database holding data you care about. The test suite
destroys the schema it is given.

## Coverage expectations by area

| Area | Minimum |
|------|---------|
| Money calculation (`sumVnd`, invoice totals) | every branch, plus a value above `Number.MAX_SAFE_INTEGER` |
| Billing utility rounding | meter parsing rejects invalid precision; utility costs cover below-half, exact-half, and above-half VND, with exact halves rounded up |
| Billing workflows | readings batch is atomic and conflict-safe; sent periods reject mutation; invoice generation is idempotent with snapshots; payment transitions and tenant 404 are covered |
| Phone normalisation | mobile, landline, each malformed form |
| Auth | register, login, wrong password, unknown email, replay, expiry — for both roles |
| Contract signing | renter-only read, hashed OTP, five-minute expiry/cooldown, three-attempt limit, atomic activation, safe error codes |
| Tenant scoping | both isolation directions, over HTTP |
| Billing rules | meter's `basePrice` is never read by the calculation |
| Renter payment | one-proof invariant, JPEG/PNG byte and 10 MB limits, proof state transitions, manager-only approval/cash payment, signed URL TTL, renter paid-mutation denial |
| Notifications | push subscription ownership/deduplication, Web Push-first ordering, bounded retries, permanent-failure fallback, stable event-key idempotency, redacted payloads |
| Meter capture | an offline entry survives a reload and syncs on reconnect (browser-level test) |

## What not to test

- Framework behaviour. That Elysia parses JSON is not our test.
- Getters, setters, and pure re-exports.
- Implementation details that a refactor would change without changing behaviour. Test the
  interface a caller uses.

## Deployment startup and migration verification

The local `docker-compose.yml` waits for PostgreSQL health before starting the backend. Backend startup runs `bun run db:migrate` before `bun run start`, and the backend restarts after transient failures. This auto-migration pattern is safe only with one backend replica. Production deployments with multiple replicas must run one migration job to completion before starting or rolling out replicas; replicas must not migrate concurrently.

Full-flow and deployment smoke checks must verify migration completion and backend health. Test migration startup against production-like data without `db:push` or database reset.

## Review gate

`security-reviewer` and `code-reviewer` (`.kilo/agent/`) both treat a missing test as a
finding, and `code-reviewer` explicitly checks for tests that cannot fail. Run them before
merging anything that touches auth, tenancy, or money.

```
/review-security
/review-code
```

## Frontend tests

Two runners, two layers, no overlap.

| Layer | Runner | Files | Needs a database or backend? | Needs a launchable browser? |
|-------|--------|-------|-------------------------------|----------------------------|
| Unit | Vitest (`node` environment) | `src/**/*.test.ts` | no | no |
| Browser | Playwright `chromium-mobile` | `e2e/**/*.spec.ts` | no | yes |
| Browser, live stack | Playwright `real-stack` | `e2e/real/**`, only with `E2E_REAL=1` | yes | yes |

The browser layer is fixture-backed on purpose: `mockApi(page, fixtures)` in `e2e/fixtures/api.ts`
intercepts `**/api/**` and answers from a literal, so the suite asserts UI behaviour without
PostgreSQL, without the Elysia backend running, and without seeded data. A request with **no
fixture throws inside the route handler**, so a spec that forgot one fails naming the key it wanted;
an earlier 404 fallback would have been indistinguishable from a legitimately empty resource, which
is worse than no fixture at all.

Server Component reads cannot be intercepted by `page.route()`. The fixture-backed command also
starts `e2e/fixtures/backend-server.ts` on loopback port `3002` and starts Next with server-only
`BACKEND_URL=http://127.0.0.1:3002`. Its typed responses cover the manager identity, motel list,
and per-motel room/renter lists used by the M2 and M3 cards. Room list fixtures apply floor,
status and name filters. Motel and room PATCH fixtures keep state per session so
refresh regressions can assert saved card/selector data without affecting parallel tests;
login/logout responses set and clear an `httpOnly` cookie through the actual Next rewrite. The fake
server is test infrastructure only and is never started by the application's dev/start commands.
Do not reuse an unrelated Next dev server for these tests: its backend setting may differ.

The `real-stack` project uses a live backend and is gated on `E2E_REAL=1`. That invocation runs the
live project instead of the fixture project and does not start the fake backend.

**Hermetic is not the same as runnable.** The fixture-backed suite needs no database or real backend,
but it still needs a browser that can start. On a minimal Linux image Chromium dies at launch with
`error while loading shared libraries: libnspr4.so` until
`sudo bunx playwright install-deps chromium` has been run once. That is a missing OS package, not a
data dependency — see the Known-state bullet in `AGENTS.md`. `bun run test` has no such requirement
and passes anywhere the dependencies install.

Unit tests cover the VND digit guard, formatters, status labels, motel selection/navigation, login
validation/submission, server session guards, and the table's search/sort/page model. React
server-rendered markup checks label/error wiring, kit accessibility contracts, and shell semantics
without a DOM environment. The dialog session's cleanup and focus restoration are tested against
an event target that doubles only the browser boundary. DOM interaction, responsive layout, and
browser navigation belong in Playwright; no `jsdom` dependency is needed.

M1 server-rendered page tests cover unfiltered room counts for all statuses, occupancy
rounding and an empty denominator, implicit and explicit owned motel selection, scoped
quick-action links, rejection of invalid scope before room reads, no-motel creation,
empty-room guidance, read failures, and the absence of deferred measures and actions.

M2 unit tests cover initial drafts, exact VND normalization and storage bounds, partial patches,
explicit settings clearing, local field errors, safe form-level API errors, and the real server
page's motel/room-count reads. `e2e/motels.spec.ts` covers create/edit, retained error drafts,
pending saves, cancellation, settings removal, session expiry, dialog focus, and 360px reflow.
Browser execution is required to verify those interactions and rendered responsive behavior;
collecting the specs alone does not establish that they pass.

M3 unit tests cover URL filters (including floor zero and int4 bounds), scoped server reads,
the active-renter join, empty/error states, exact rent normalization, local field errors,
partial edits and floor clearing, status-only changes, safe API banners, and a reopened
form's fixed baseline across a pending save. `e2e/rooms.spec.ts` covers applying/clearing
filters and reload, create/edit/status actions, pending saves, retained conflict/error drafts,
session expiry, cancellation/focus, the pending-save refresh race, and 360px reflow.
Browser execution is required to verify those interactions and rendered responsive behavior.

M4 unit tests cover scoped renter list/detail reads, room-filter links, named rooms,
formatted/copyable contacts, separate tenancy/OA labels, truthful missing start dates,
nullable contract summaries, calendar dates, exact invoice amounts and payment statuses,
CCCD URL conditions and safe image attributes. Magic-link tests exercise the real API boundary:
bodyless relative POST, returned URL, coalesced requests, retry and safe 401/404/429/5xx/network
errors. `e2e/renters.spec.ts` covers room-filter navigation/reload, 360px stacked rows,
keyboard generation/copy, disabled pending actions, focused retryable errors and expired
sessions. `e2e/full-flow.spec.ts` covers manager login, one-time exchange, portal profile and
invoice reads at 430px, keyboard submission, replay rejection, expired-token recovery, and
invalid-link recovery without internal-error leakage. Its RSC fixtures match current
null-contract/empty-invoice responses. Browser execution is required to verify these
interactions and responsive behavior. Payment-proof and cash-confirmation E2E are blocked:
no corresponding frontend/API routes exist yet.

`e2e/component-kit.spec.ts` bundles `e2e/fixtures/component-kit.tsx` with Bun and serves its HTML
through a Playwright route interception. There is no component gallery route in the product. Run
`bun run build` before this suite: the harness loads the real compiled Tailwind CSS from
`.next/static/chunks/`. The suite exercises native dialog focus/Escape/controlled close, clipboard
success/failure, internal table search/sort/pagination, toast dismissal, mobile reflow, hit targets,
visible focus, reduced motion, and monetary alignment. `BUN_EXECUTABLE` can select the Bun binary
when `bun` is not on the runner's PATH.

## Task 9 delivery gate

Run backend checks sequentially because every integration file resets one PostgreSQL schema. Run
`cd backend && bun run typecheck`, then each explicit file in `docs/full-flow-test-plan.md` in listed
order. Run frontend in order: `bun run typecheck`, `bun run lint`, `bun run build`, `bun run test`,
then fixture `bun run test:e2e`. Run `E2E_REAL=1 bun run test:e2e` only with QA stack and explicit
credentials. A browser launch failure from missing OS libraries is **blocked**, never pass. Record
command, timestamp, SHA, counts, environment, and blocker in the Task 9 report.

## Commands

```bash
cd backend && bun test                                  # everything
cd backend && bun test src/test/tenancy.test.ts         # one file
cd backend && bun run typecheck
cd frontend && bun run typecheck
cd frontend && bun run lint
cd frontend && bun run test                             # vitest
cd frontend && bun run test:e2e                         # playwright, fixture-backed
cd frontend && E2E_REAL=1 bun run test:e2e              # live e2e/real/** only
```
