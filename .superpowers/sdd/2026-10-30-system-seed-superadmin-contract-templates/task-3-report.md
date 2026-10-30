# Task 3 report — QA-only demo seed guard

## Changes

- Added `assertDemoSeedAllowed(env)` to require exact `APP_ENV=qa` and `SEED_DATABASE=true`.
- `seedData()` runs guard before its first database operation. `NODE_ENV=production` remains permitted only when independent QA marker and opt-in are exact.
- Added focused tests for production/staging/unset/non-QA/missing-opt-in refusal, data preservation on refusal, and deterministic repeated seeding under QA opt-in.
- No QA invocation hook was found or added.

## Verification

- RED: `bun test test/demo-seed-guard.test.ts` failed because `assertDemoSeedAllowed` was not exported.
- GREEN: `PATH="$HOME/.bun/bin:$PATH" bun test test/demo-seed-guard.test.ts` — 7 pass, 0 fail, 31 assertions.
- Seed execution occurred only against configured local test database; no QA/production seed and no Dokploy calls.
