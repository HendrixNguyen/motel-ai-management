# OTP exhaustion review fix report

- Changed max-attempt exhaustion to return `OTP_INVALID`.
- Kept `OTP_EXPIRED` for missing or time-expired OTP state only.
- Added contract signing regression test covering fourth verification after three failed attempts.
- Updated API contract and contract design spec error semantics.

Verification:

- Backend typecheck: pending.
- Contract tests: PostgreSQL authentication blocker remains documented in prior report (`28P01`, user `postgres`).
