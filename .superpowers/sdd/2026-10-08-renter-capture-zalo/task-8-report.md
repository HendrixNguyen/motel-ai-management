
## Task 8 remaining findings update

- Added startup expiry producer invocation and daily scheduler in `backend/src/index.ts`.
- Moved expiring-contract projection into contract service with inclusive current..until bounds; notification module no longer imports contract schema.
- Replaced renter↔notification runtime dependency with neutral `shared/notification-recipient.ts` resolver.
- Expiry key remains stable and deduplicated by contract/end-date/window.
- Typecheck passes.
- DB integration test remains blocked by repeated `Failed query` during local PostgreSQL reset/setup; migration repair and full producer/provider assertions require functioning TEST_DATABASE_URL.
