# ADR-0009 — The frontend is tested by Vitest and Playwright, both hermetic

- **Date:** 2026-10-05
- **Status:** Accepted
- **Spec:** [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](../superpowers/specs/2026-10-03-motel-management-design.md)

## Context

[`docs/testing-strategy.md`](../../testing-strategy.md) requires a browser-level test of the
manager frontend — "Meter capture: an offline entry survives a reload and syncs on reconnect
(browser-level test)" — and states plainly that a behaviour change without a test is an
unfinished change. It named no runner, and `frontend/` had none: it was a `create-next-app`
scaffold with no test script at all.

What the manager frontend actually needs to prove is not "does React render". It is a set of
properties that only a real browser can show: that the `httpOnly` session cookie survives the
same-origin rewrite proxy (ADR-0008), that a screen does not scroll horizontally at 375px, that
every action is reachable by keyboard, that a status badge exposes text and not colour alone.
Those are the rules the UI spec is written in.

The binding constraint is the machine. Backend tests already need a live PostgreSQL, and this
repo's own risk table records that CI and development machines are not guaranteed to have one.
A frontend suite that also needs a database, a migrated schema, a seeded manager, and a running
Elysia process is a suite that will silently stop running.

Four options were considered:

| Option | Verdict |
|--------|---------|
| **No runner** | Rejected. Directly contradicts `testing-strategy.md`, and the money and auth rules in `src/lib/format` are exactly the kind that break silently. |
| **Playwright only** | Rejected. Every Playwright test needs a browser binary and a running `next dev`; the pure string and BigInt arithmetic in `parseVndDigits` / `formatVnd` would then be verified by paying that cost for every assertion, and the suite could not run at all on a machine without a browser. |
| **Vitest only** | Rejected. Cannot verify the cookie round-trip, the 375px no-scroll rule, keyboard reachability, or focus-ring clipping — none of which exist below the DOM boundary. Adopting it alone would mean shipping those rules untested while claiming coverage. |
| **Both, split by what each can actually see** | Accepted. |

The two runners answer different questions, and neither can substitute for the other.

## Decision

**Vitest**, devDependency, for unit tests under `src/` only. Default `node` environment — no
`jsdom`, no `happy-dom`. What is under test is string and BigInt arithmetic: `formatVnd("3850000")`
must return `"3.500.000 ₫"` without the digit string ever passing through `Number`. A DOM
environment would be a third dependency bought for nothing, and it would invite component tests
that belong in the browser layer. `vitest.config.mts` sets `resolve.tsconfigPaths` because the
repo's `@/*` → `src/*` convention is not a default in Vite 8.

**Playwright**, devDependency, for `e2e/**/*.spec.ts` at 375×667 with two projects:

- `chromium-mobile` — the default project, and the one that must always pass.
- `real-stack` — `testMatch: "e2e/real/**"`, gated on `E2E_REAL=1`, for the same flow against a
  live backend and PostgreSQL. It is declared in the config and filtered out, never silently
  absent, so the gap is visible rather than forgotten.

**The `chromium-mobile` project is hermetic.** `mockApi(page, fixtures)` in `e2e/fixtures/api.ts`
intercepts `**/api/**` and answers from literals, so no request ever reaches PostgreSQL or the
Elysia backend. Standing up a real stack instead would have meant a migration, a seed script, a
credential fixture and a teardown — four new moving parts whose failure mode is a suite that
skips itself when the database is absent. Interception makes the browser suite runnable on a
machine with neither.

**A request with no fixture throws inside the route handler**, naming the key it wanted. This is
load-bearing and was got wrong first: an earlier version answered the backend's real
`404 NOT_FOUND`, which a spec cannot tell apart from a legitimately empty resource. A forgotten
fixture then produced a passing test asserting against a lie — the one outcome
`testing-strategy.md` calls worse than no test at all.

Both are devDependencies. Neither ships in the bundle; the browser binary is fetched once per
machine with `playwright install`.

## Consequences

**Good**

- The browser suite runs on a machine with no database and no backend, which is the only reason
  it will keep running
- Money arithmetic is verified without a browser, so `bun run test` is fast and cheap enough to
  run on every change
- The rules that only a browser can show — cookie round-trip, 375px layout, keyboard reach — are
  actually testable instead of aspirational
- One import convention (`@/*`) and one runner per layer; a file is collected by exactly one of them

**Bad**

- Fixtures are hand-written literals, so they can drift from the API contract. Mitigated for now
  only by typing them `unknown`; the real fix is `lib/api/types.ts`, which Task 4 adds and which
  makes a shape change a compile error.
- Two runners, two ways to run a test, and a real risk of reaching for the wrong one. Mitigated
  by scope: **Vitest is for pure functions and is never used to render a component; Playwright is
  for anything that needs a DOM and is never used to assert on a string transform.**
- A non-2xx response cannot yet be expressed as a fixture — the map holds 200 bodies only — so
  Task 11's error-state specs must extend it to accept `{ status, body }` rather than switch the
  throw off.
- `bun run test:e2e` needs a browser binary *and* its OS libraries. On a minimal Linux image
  Chromium fails at launch with `libnspr4.so` until `sudo bunx playwright install-deps chromium`
  has been run once. `bun run test` is unaffected. Hermetic is not the same as runnable, and
  conflating the two is how a suite that "needs no database" comes to be reported as green.

**Revisit when** component-level behaviour is worth testing below the browser — many small
interaction states on `Modal` or `DataTable` — at which point Vitest would need a DOM environment
and this ADR's "no `jsdom`" clause should be reopened on its own evidence rather than inherited.
