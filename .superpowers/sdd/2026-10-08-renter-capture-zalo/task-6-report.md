
## Query-key cache test fix appended

- Cache mock now normalizes full same-origin URL, preserving query strings in `put` and `match`.
- Added query-distinct assertion: `motel=two` does not hit `motel=one` cache entry.
- Offline repeat uses exact first URL and verifies cached response body/status.

Verification:
- Typecheck pass.
- Lint pass with existing Next `<img>` optimization warning.
- Vitest pass: 350 tests.
- Build pass.
- Capture E2E pass: 3 tests.
