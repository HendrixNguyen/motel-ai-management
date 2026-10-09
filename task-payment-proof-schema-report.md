# Payment proof schema test type fix

## Scope

Fixed TS2345 in `backend/src/test/payment-proof-schema.test.ts` by filtering status tuples with `some` equality, preserving Drizzle's typed update builder and all database assertions.

## Verification

- `bun run typecheck` — passed.
- `bun test src/test/payment-proof-schema.test.ts` — 7 tests passed against local `motel_test`; run after typecheck, no concurrent backend tests.
