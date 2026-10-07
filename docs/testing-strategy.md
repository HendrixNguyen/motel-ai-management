# Testing Strategy

- **Date:** 2026-10-03
- **Applies to:** `backend/` (Bun test) and `frontend/` (to be chosen when the first
  frontend test lands)

Tests are a deliverable, not a follow-up. A behaviour change without a test is an unfinished
change.

## The standard

| Layer | What it proves | When |
|-------|----------------|------|
| Database constraints | The rule holds even when the API is bypassed | Every new constraint |
| Service unit tests | The calculation or rule is correct | Every service function with a branch |
| HTTP boundary tests | Tenant scoping holds through a real request | Every route that filters by tenant |
| Pure-function tests | Money, phone, dates, formatting | Once, then they never change |

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
| Tenant scoping | both isolation directions, over HTTP |
| Billing rules | meter's `basePrice` is never read by the calculation |
| Meter capture | an offline entry survives a reload and syncs on reconnect (browser-level test) |

## What not to test

- Framework behaviour. That Elysia parses JSON is not our test.
- Getters, setters, and pure re-exports.
- Implementation details that a refactor would change without changing behaviour. Test the
  interface a caller uses.

## Review gate

`security-reviewer` and `code-reviewer` (`.kilo/agent/`) both treat a missing test as a
finding, and `code-reviewer` explicitly checks for tests that cannot fail. Run them before
merging anything that touches auth, tenancy, or money.

```
/review-security
/review-code
```

## Commands

```bash
cd backend && bun test                                  # everything
cd backend && bun test src/test/tenancy.test.ts         # one file
cd backend && bun run typecheck
cd frontend && bun run lint
```