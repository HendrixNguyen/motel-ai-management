# Task 3 report

## Follow-up critical/high fixes

- OTP transient secrets travel only through in-memory delivery input; outbox payload stores `[REDACTED]` audit values. If process restart loses secret, event becomes permanent `secret_unavailable` and is not retried.
- Renter lookup and Zalo follower mutation use exported `renter.service` functions.
- Webhook HMAC verifies exact raw request bytes; malformed JSON and missing required event fields return `VALIDATION_ERROR`.
- Added durable webhook event-id deduplication; follower mapping ignores body motel authority and requires globally unambiguous verified phone mapping.
- Delivery uses atomic lease claim (`leaseId`/`leaseUntil`) and lease-guarded completion to prevent concurrent duplicate sends.
- Added typed retry failure taxonomy and safe reason codes only; provider text never enters DB/logs.
- Added `attempt_count between 0 and 3` CHECK migration.

## Verification

- `bun run typecheck`: pass.
- `bun test src/test/notification.test.ts`: blocked by local PostgreSQL schema/query failure (`Failed query`).
- `bun test src/test/zalo.test.ts`: local DB lacks migrated `notification_webhook_events`; test cannot complete.
- Unrelated untracked files preserved.
