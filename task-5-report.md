# Task 5 report

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

- Invalid VND input now rejects without arbitrary character stripping.
- FileUpload exposes `onRetry`, forwards `files`, and renders linked validation errors.
- DateField accepts only valid `YYYY-MM-DD` calendar dates.
- Field compatibility mode preserves child classes and existing ARIA values while merging descriptions.
- Behavior tests expanded from 6 to 10.
