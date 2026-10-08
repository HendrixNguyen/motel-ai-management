
## Final test-boundary fixes appended

- E2E now inspects Cache Storage contents and asserts no `/api/` or signed URL entries.
- Service-worker tests assert actual response status/body for online shell, cached capture navigation, and offline fallback.
- Added table-driven exclusions for non-GET, cross-origin, `/_next/`, `_rsc`, `RSC`, and `Next-Router-State-Tree` requests.

Verification:
- Typecheck pass.
- Lint pass with existing Next `<img>` optimization warning.
- Vitest pass: 350 tests.
- Build pass.
- Capture E2E pass: 3 tests.
