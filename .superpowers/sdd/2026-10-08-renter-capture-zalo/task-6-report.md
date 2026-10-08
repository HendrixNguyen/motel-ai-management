
## Final E2E/auth fixes appended

Commit pending.

- Capture E2E now seeds `manager_session=capture-session`; UUID motel/period assertions match fixture data.
- Room walk index derives from `currentId` and active reading, preserving electric → water → terminal progression.
- Service worker exposes executable `captureShouldHandle` decision logic; Vitest evaluates it with mocked request/cache boundaries rather than source strings.

Verification:
- `bun run typecheck` pass.
- `bun run lint` pass with existing Next `<img>` optimization warning.
- `bun run test` pass: 350 tests.
- `bun run build` pass.
- `bun run test:e2e --grep capture` pass: 3 tests.
