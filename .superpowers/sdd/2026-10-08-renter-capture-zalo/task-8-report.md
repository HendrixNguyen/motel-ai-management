
## Final Task 8 follow-up

- Recipient access now routes through renter service projection; notification layer no longer imports renter schema.
- Payment event moved after successful invoice transaction commit; enqueue failure cannot roll back payment state.
- Added stable contract expiry producer key: `contract:<id>:expiry:<endDate>:<windowDays>`.
- Typecheck passes.
- Notification integration test remains blocked by local PostgreSQL `Failed query` during reset/setup; no DB-backed test claims made.
- OTP remains explicit fail-safe: secret is process-memory only; restart/worker loss marks event `secret_unavailable` instead of sending plaintext or mutating contract state.
