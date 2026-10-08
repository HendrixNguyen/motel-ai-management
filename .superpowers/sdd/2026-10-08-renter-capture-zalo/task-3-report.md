# Task 3 report

## Final review fixes

- Removed notification schema direct imports and FK references to motel/renter tables per ADR-0004. Notification outbox owns opaque IDs; renter service owns follower mapping operations.
- Added `zalo_oa_motel_mappings` migration, unique OA constraint, non-empty OA check, index, and reset registration.
- Follow mapping failures now throw inside webhook transaction; dedup insert rolls back so retry remains possible.
- Webhook validates non-null object, event enum, non-empty follower ID, and required non-empty phone before dedup insert.

## Verification

- `bun run typecheck`: pass.
- `bun test src/test/zalo.test.ts`: blocked by local PostgreSQL schema/query failure (`notification_webhook_events` missing).
- `bun test src/test/notification.test.ts`: blocked by local PostgreSQL schema/query failure.
- Unrelated untracked files preserved.
