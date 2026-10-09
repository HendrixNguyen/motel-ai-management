
## Final review fixes
- Restored Vitest globals between tests with `vi.unstubAllGlobals()`.
- Strengthened blocked-storage coverage: `getStoredTheme()` fallback, guarded `setItem` call assertion, and DOM theme application.
- Listener lifecycle coverage now creates system and explicit helper cleanups and asserts one subscription plus one removal.

## Verification
- `bun test src/components/ui/__tests__/theme.test.tsx`: blocked; `bun` unavailable.
