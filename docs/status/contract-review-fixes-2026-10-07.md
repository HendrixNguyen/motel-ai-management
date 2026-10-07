# Contract review fixes report

Implemented final review fixes on `feat/contract-management`:

- Split manager and renter contract route auth scopes into separate Elysia plugins.
- Renter JWT and cookie lifetime reduced to 24 hours.
- Exhausted OTP attempts now return `OTP_EXPIRED`; invalid codes remain `OTP_INVALID`.
- Renter contract paths use singular latest-contract route and singular resource route grouping without mixed auth registration.
- Contract route schemas enforce ISO `YYYY-MM-DD`, digit-only VND values capped at 14 digits, and required clause arrays.
- Contract service validates date ordering and VND magnitude before persistence.
- Contract clause snapshots are non-null at schema/type level, with migration backfill/default.
- API contract updated for OTP exhaustion and 24-hour renter sessions.

Verification:

- `cd backend && bun run typecheck` passed.
- `cd backend && bun test src/test/contract.test.ts src/test/contract-template.test.ts src/test/contract-signing.test.ts` blocked by PostgreSQL authentication: `password authentication failed for user "postgres"` (`28P01`). Tests did not reach assertions.
