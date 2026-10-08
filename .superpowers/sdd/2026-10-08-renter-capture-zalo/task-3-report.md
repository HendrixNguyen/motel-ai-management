# Task 3 report

## Status
Implemented notification outbox and Zalo provider seams. Backend typecheck passes.

## Changes
- Added `notification_events` schema and migration with unique event key, channel, status, attempts, retry time, failure class, provider ID, timestamps.
- Added `enqueueNotification`, `deliverNotification`, `setZaloProvider`.
- Added OA/ZNS selection, OTP/payload redaction, bounded transient retry, permanent failure handling.
- Added signed Zalo follow/unfollow webhook route with idempotent state updates.
- Registered schema, route, and test reset table.
- Added notification and webhook tests.

## Tests
- `bun run typecheck`: pass
- `git diff --check`: pass
- `bun test src/test/notification.test.ts`: blocked/fails because local test database schema is unavailable (`Failed query`).
- `bun test src/test/zalo.test.ts`: not run separately; shared app import requires configured DB only for verified follow path.

## Concerns
- Existing local PostgreSQL test schema is not migrated; `bun run db:migrate` also fails with `Failed query`.
- Webhook maps follower payload to renter by normalized phone because provider payload lacks a tenant key.
- Existing unrelated untracked files preserved.
