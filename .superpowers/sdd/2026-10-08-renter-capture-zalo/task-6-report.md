
## Review fixes appended

Commit `065e55b8216a0f6c2d79f305a4fb31efe100555b`.

- Added independent `/capture`, `/capture/[periodId]`, and `/capture/[periodId]/room/[readingId]` screens.
- Added startup/reconnect sync, conflict messaging, sent/closed lock, logout queue clear.
- Removed volatile memory fallback; unsupported IndexedDB now returns `CAPTURE_QUEUE_UNSUPPORTED`.
- Added separate Blob photo queue and retry path.
- Added typed conflict details and upload client response.
- Restricted service worker to explicit same-origin shell paths; bypasses API, RSC, Next assets, signed paths.
- Added capture Playwright spec and service-worker boundary test.

Verification:
- typecheck pass
- lint pass with existing hook warning resolved after commit preparation
- Vitest pass: 349 tests
- build pass
- capture E2E attempted; fixture route assumptions caused 2 UI failures, service-worker request test passed. Browser run available but full capture fixture data still needs alignment.
