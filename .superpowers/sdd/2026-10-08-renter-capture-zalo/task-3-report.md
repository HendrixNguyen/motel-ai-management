# Task 3 report

## Review fixes

- Lease loser now returns persisted event immediately and never invokes provider.
- Webhook deduplication and renter mapping run in one DB transaction; mapping errors leave dedup row absent so provider retries safely.
- Webhook body no longer trusts `motel_id`; mapping resolves one globally unambiguous renter by verified phone. Canonical route remains `POST /api/zalo/webhook`.
- Added attempt-count Drizzle `check` declaration and migration constraint.
- Added restart-safe OTP behavior: transient secret remains process-memory only; after restart event fails permanently with `secret_unavailable`, never sends redacted placeholder.
- Added typed provider failure taxonomy and lease fields.

## Verification

- `bun run typecheck`: pass.
- `bun test src/test/notification.test.ts`: blocked by local PostgreSQL schema/query failure (`Failed query`).
- `bun test src/test/zalo.test.ts`: blocked by local DB/schema setup; one assertion cannot complete.
- Unrelated untracked files preserved.
