
## Final review cleanup

- Removed stale shared resolver implementation and notification module resolver re-export; shared layer now contains only neutral recipient type, with renter-owned DB projection injected at app composition.
- Added explicit `ExpiringContract` DTO return type for contract expiry projection.
- Confirmed duplicate `otp_sent_at` definition remains across immutable `0000` baseline and `0001` alter migration; no migration rewrite performed to preserve repo immutability. Existing reset migration chain still fails against local DB.
- `bun run typecheck` passes.
- Sequential notification and contract DB tests both blocked by `Failed query` during PostgreSQL reset/setup; expiry tests could not execute for same reason.
