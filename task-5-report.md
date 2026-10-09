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
