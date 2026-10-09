
## Review fixes
- Guarded `localStorage` reads/writes and normalized invalid persisted values to `system`.
- Applied system theme as explicit `light`/`dark`, including `color-scheme`, and synchronized `matchMedia` changes while system mode is active.
- Moved theme coverage into `src/components/ui/__tests__/theme.test.tsx` with behavior-focused mocked browser APIs.
- Improved safe-area padding, scoped scroll-margin selectors to `main`, and merged body rules.

## Verification
- `bun test src/components/ui/__tests__/theme.test.tsx`: blocked; `bun` unavailable.
- `bun run typecheck`: blocked; `bun` unavailable.
- Playwright verification: blocked; `bunx` unavailable.
