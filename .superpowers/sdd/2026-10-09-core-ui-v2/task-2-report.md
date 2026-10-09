
## Re-review fixes
- Theme media listener now follows current selected theme through effect dependencies.
- Selecting explicit theme removes system listener; selecting system subscribes again.
- Blocked-storage test now exercises `changeTheme`, including guarded persistence and DOM application, instead of directly testing mock behavior.

## Verification
- `bun test src/components/ui/__tests__/theme.test.tsx`: blocked; `bun` unavailable.
