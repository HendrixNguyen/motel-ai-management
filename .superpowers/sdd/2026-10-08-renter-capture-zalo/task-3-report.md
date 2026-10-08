# Task 3 report

## Final review fixes

- Supplied `event_id` must be a non-empty string; absent event IDs hash exact raw body.
- Follow payload must contain non-empty `oa_id`; webhook resolves OA mapping before renter mutation.
- OA mapping and renter isolation remain transaction-scoped; mapping failure throws and rolls back dedup row for retry.
- Canonical docs route remains `POST /api/zalo/webhook`.

## Verification

- `bun run typecheck`: pass.
- `NODE_ENV=test bun test src/test/notification.test.ts src/test/zalo.test.ts`: blocked by local PostgreSQL query/schema failure.
- `bun run db:migrate`: blocked by local PostgreSQL query failure; migration chain could not be reset here.
- Unrelated untracked files preserved.
