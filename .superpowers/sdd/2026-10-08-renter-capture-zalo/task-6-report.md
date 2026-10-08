
## Final SW offline-cache fix appended

- `addAll` now normalizes shell entries through same absolute URL key helper used by `put`/`match`.
- Added uncached capture navigation assertion: offline request returns `/offline.html` shell response with status/body.

Verification:
- Typecheck pass.
- Lint pass with existing Next `<img>` optimization warning.
- Vitest pass: 350 tests.
- Build pass.
- Capture E2E pass: 3 tests.
