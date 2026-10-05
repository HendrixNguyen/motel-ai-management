/**
 * A VND amount as it crosses HTTP: **always a string of digits**, never a number.
 *
 * Owned here and re-exported by `lib/api/types.ts` (D6), so every frontend shape that carries an
 * amount names one type. The alias is `string`, not a branded type — a brand would demand an `as`
 * cast on every fixture and literal — which means the guarantee is a documented contract plus the
 * runtime gate below, not the compiler. `docs/api-contract.md` states the wire format and
 * `numeric(14,0)` is the storage bound; `backend/src/shared/money.ts` re-checks both server-side.
 */
export type VndString = string;

/** An amount is digits and nothing else. Anchored, so `""` fails with it. */
const DIGITS_ONLY = /^\d+$/;

/** The separators a human or `formatVndPlain` may have typed: `.` and any whitespace. */
const SEPARATORS = /[.\s]/g;

/**
 * `"007"` is 7. Normalised to match the backend's `BigInt` gate, so what a field shows is exactly
 * what the API is sent.
 */
const LEADING_ZEROS = /^0+(?=\d)/;

/**
 * Inserts a dot before every group of three digits that is not at the end of the string.
 *
 * Applied to the **digit string**. `Number(input)` and `Intl.NumberFormat` both lose precision
 * above `Number.MAX_SAFE_INTEGER`, and `numeric(14,0)` has room for such values in principle; a
 * formatter that reaches for either prints a wrong amount rather than an obviously broken one.
 */
const GROUPS = /\B(?=(\d{3})+(?!\d))/g;

function groupDigits(digits: VndString): string {
  return digits.replace(GROUPS, ".");
}

/**
 * The only gate an amount passes through on its way into the app — `lib/api/client.ts` calls it
 * on every money field of every response, and an editable field calls it on submit.
 *
 * Strips `.` and whitespace, rejects anything else non-digit (letters, a sign, a thousands comma,
 * `₫`) and rejects input with no digits left. Returns `null` rather than throwing, so a caller can
 * report the field it came from.
 *
 * Magnitude is deliberately not checked here: the column is `numeric(14,0)` and the backend owns
 * that bound (`parseAmount` answers `VALIDATION_ERROR`), and returning `null` for "too large" would
 * be indistinguishable from "not an amount".
 *
 * Note the strip rule treats any dot as a separator, so `"1.5"` is `15`. A form field must not feed
 * half-typed text through this on every keystroke; the grouped value `formatVndPlain` produces is
 * the input this expects.
 */
export function parseVndDigits(input: string): VndString | null {
  const stripped = input.replace(SEPARATORS, "");
  if (!DIGITS_ONLY.test(stripped)) return null;
  return stripped.replace(LEADING_ZEROS, "");
}

/**
 * A VND amount for display: `3.500.000 ₫`.
 *
 * `digits` must already be digits — `parseVndDigits` is the gate, and this does not re-check, so
 * a caller that formats an unvalidated field shows whatever it typed.
 *
 * The space before `₫` is U+0020, not U+00A0. A non-breaking space would keep the symbol attached
 * to the digits on its own, which is a layout guarantee made invisible in a data layer and applies
 * to no other string this app formats; `docs/frontend-ui-specs.md` requires money never to wrap,
 * so any element holding this string must carry `whitespace-nowrap` (with `tabular-nums`, as the
 * spec's typography section requires for amounts).
 */
export function formatVnd(digits: VndString): string {
  return `${groupDigits(digits)} ₫`;
}

/**
 * Grouped digits with no currency suffix, for a value inside an editable field.
 *
 * The suffix is dropped because it is not part of the number: a field pre-filled with
 * `3.500.000 ₫` makes the user delete the `₫` before typing. `parseVndDigits` reads this back
 * unchanged, which is what makes a field round-trip on submit.
 */
export function formatVndPlain(digits: VndString): string {
  return groupDigits(digits);
}
