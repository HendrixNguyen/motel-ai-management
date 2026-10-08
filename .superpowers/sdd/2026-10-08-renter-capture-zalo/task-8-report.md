
## Blocker follow-up

- Recipient resolver now truly unset by default; notification enqueue/delivery explicitly fail until app composition injects renter-owned projection.
- Fresh reset remains blocked by migration-chain duplicate `otp_sent_at` definitions in immutable 0000/0001 history; no unsafe rewrite performed.
- Advisory scheduler lease and focused DB tests remain blocked because local PostgreSQL reset fails before tests execute.
- `bun run typecheck` passes.
