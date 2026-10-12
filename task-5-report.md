# Task 5 report

- **Status:** Partial / blocked
- **Scope boundary:** Task 5 review findings only; not full live QA journey.
- **Blockers:** Contract create/send controls absent. Billing/payment journey remains skipped: no safe UI setup or QA credentials available. No live QA config or network used.

## Scope

Implemented Core UI v2 form, money/date, select/textarea, upload, preview, error summary, and action-bar primitives.

## Tests

- `PATH="$HOME/.bun/bin:$PATH" bunx vitest run src/components/ui/__tests__/form-upload.test.tsx` — 6 passed.
- Source typecheck (`bunx tsc --noEmit`, excluding pre-existing `.next/dev/types` errors) — passed.
- ESLint — 0 errors; existing Next `<img>` warning in `image-preview.tsx`.

## Notes

- `Field` keeps render-prop contract and now also wires plain child controls.
- `FileUpload` validates JPEG/PNG and accepts exactly 10 MiB; callbacks receive `File[]`, never storage keys.
- Full typecheck remains blocked by stale generated `.next/dev/types` errors unrelated to Task 5.

## Review fixes

- `frontend/e2e/real/core-flow.spec.ts` asserts zero contract create/send buttons and adds a static `blocked` annotation; absence is not a passing contract/payment journey.
- Billing/payment journey stays explicitly skipped because no safe UI setup or confirmed QA credentials/isolation are available. Suite remains gated by `E2E_REAL=1` and validated QA config; no live QA config/network or data writes used.
- Invalid VND input now rejects without arbitrary character stripping.
- FileUpload exposes `onRetry`, forwards `files`, and renders linked validation errors.
- DateField accepts only valid `YYYY-MM-DD` calendar dates.
- Field compatibility mode preserves child classes and existing ARIA values while merging descriptions.
- Behavior tests expanded from 6 to 10.
- MoneyField now emits empty string when cleared while continuing to reject malformed input.
