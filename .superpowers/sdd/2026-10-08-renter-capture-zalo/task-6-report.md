
## Final SW cache mock fix appended

- Normalized Cache Storage mock keys through one URL-path helper in `put` and `match`.
- Offline navigation assertion now verifies second navigation returns response cached by first online navigation, including status/body.

Verification:
- Typecheck pass.
- Lint pass with existing Next `<img>` optimization warning.
- Vitest pass: 350 tests.
- Build pass.
- Capture E2E pass: 3 tests.
