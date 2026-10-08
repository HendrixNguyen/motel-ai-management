
## Final remaining findings update

- Notification recipient lookup is now injected at app composition via renter-owned projection; notification/shared code has no renter schema import.
- Expiry window is typed and validates `0..365` days; contract projection bounds end dates inclusively from current date through `until`, active contracts only.
- Scheduler now targets fixed daily UTC 00:05, retries up to three times with bounded delays, uses `unref`, and avoids interval drift.
- OTP policy remains fail-safe: enqueue acceptance is required before success; process restart loses secret and permanently fails event as `secret_unavailable`, with no plaintext persistence.
- Typecheck passes. DB integration remains blocked by local PostgreSQL `Failed query`; migration reset repair and DB-backed boundary/provider assertions could not run.
