
## Service worker review fix appended

- Service-worker Vitest now executes install, activate, and fetch handlers with mocked `self`, Cache Storage, network fetch, and `respondWith`.
- Assertions cover shell precache, capture navigation network/cache fallback, API bypass, signed URL bypass, and offline fallback.
- Capture E2E remains green with auth cookie and capture route fixtures.

Verification:
- Typecheck pass.
- Lint pass with existing Next `<img>` optimization warning.
- Vitest pass: 350 tests.
- Build pass.
- Capture E2E pass: 3 tests.
