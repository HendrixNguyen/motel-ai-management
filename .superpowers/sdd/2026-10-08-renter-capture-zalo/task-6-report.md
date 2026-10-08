
## Review fixes appended

Implemented capture flow corrections and truthful sync state.

- `/capture` now links to `/capture/[periodId]`.
- Added typed billing fixtures and fixture backend routes for periods, detail, and readings.
- Reading screen now shows utility title, previous reading, live usage/cost, photo preview/retake, lock state, sync state, and typed conflict handling.
- Sync returns sent/failed/conflict/locked counts; logout clears queue in `finally`.
- Added queue unsupported behavior tests and sync result tests.
- Service worker supports dynamic capture navigation fallback while bypassing API/RSC/Next/signed paths.

Verification:
- Typecheck pass.
- Vitest pass: 350 tests.
- Build pass.
- Lint pass with one Next image optimization warning.
- Capture E2E still has 2 fixture UI failures; service-worker test passes. Failure remains fixture server/session route mismatch, not browser launch.
