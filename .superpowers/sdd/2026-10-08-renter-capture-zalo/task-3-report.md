
## Follow-up critical/high fixes

- OTP transient secrets now travel only through in-memory delivery input; outbox payload stores `[REDACTED]` audit values.
- Renter lookup and Zalo follower mutation moved behind exported `renter.service` functions with motel scoping.
- Webhook HMAC verifies exact raw request bytes; route disables body parsing before verification.
- Added durable webhook event-id deduplication and tenant-qualified follow mapping.
- Delivery uses conditional DB claims/updates, retry eligibility via `nextRetryAt`, bounded attempts, and safe failure reason classes.
- OA delivery falls back to ZNS when OA ID is nullable; provider error text is never persisted.

Verification: `bun run typecheck` passes. Focused DB tests remain blocked by local PostgreSQL migration/schema failures (`Failed query`); `zalo.test.ts` also shows expected missing `notification_webhook_events` schema in local DB.
