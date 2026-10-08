# Task 3 report

## Final fixes

- OA mapping is notification-owned and now resolves `oa_id -> motel_id` before renter mapping; renter service receives motel scope explicitly.
- Follow mapping failures throw inside transaction, rolling back webhook dedup row for retry.
- Supplied `event_id` remains accepted only as non-empty value through route validation; absent IDs hash exact raw body.
- Removed duplicate attempt-count constraint from lease migration; added safe drop/re-add migration for existing duplicate schemas.

## Verification

- `bun run typecheck`: pass.
- `bun test src/test/zalo.test.ts`: blocked by local PostgreSQL schema/query failure (`notification_webhook_events` missing).
- `bun test src/test/notification.test.ts`: blocked by local PostgreSQL schema/query failure.
- Unrelated untracked files preserved.
