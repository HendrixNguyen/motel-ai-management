
## Final findings appended

Commit `22ecb289ebad6837f0c2ff2a79f0715d509c7c20`.

- Capture entry now routes to capture period screen.
- Room walk shows room title, utility progress, electric/water sequence, save-and-next, back-to-room-list, explicit sync/lock/offline statuses, and photo retake.
- Capture E2E UUID fixture corrected and assertions target `/capture` routes.
- Service-worker test uses mocked cache/fetch boundary behavior instead of source-string checks.
- Queue and sync behavior tests remain present; unsupported IndexedDB is explicit rather than volatile fallback.

Verification:
- Typecheck pass.
- Vitest pass: 350 tests.
- Build pass.
- Lint pass with one Next `<img>` optimization warning.
- Capture E2E: service-worker boundary test passes; two UI tests still fail during fixture-backed server navigation and need further fixture route/session diagnosis.
