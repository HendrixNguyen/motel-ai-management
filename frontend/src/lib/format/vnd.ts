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

/**
 * An amount is either bare digits or a properly grouped vi-VN amount: `3500000` or `3.500.000`.
 *
 * The grouped alternative is not a convenience, it is the whole point. Stripping every dot — the
 * rule the first draft of this file used — turns `1.500.00` into `150000` and `1.5` into `15`, ten
 * and a hundred thousand times too small, with nothing left to report. A mistyped group separator is
 * the most likely typo in a money field, and a validator that cannot see it converts the typo into a
 * wrong invoice. `backend/src/shared/money.ts` is the mirror image: it gates on `/^\d+$/` and
 * *throws* `Số tiền không hợp lệ`, so a frontend that accepted these would launder the server's
 * rejection into a silently corrupt amount.
 *
 * Anchored, so `""` fails with the rest.
 */
const AMOUNT = /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/;

/** The dots of a grouped amount, removed only after `AMOUNT` has approved them. */
const DOTS = /\./g;

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
 * Accepts bare digits (`3500000`) and grouped vi-VN digits (`3.500.000`), returns the bare digits
 * in both cases because that is what the wire format is. Rejects letters, a sign, a thousands
 * comma, `₫`, and any dot that is not a thousands separator. Returns `null` rather than throwing,
 * so a caller can render a Vietnamese message against the field the bad value came from.
 *
 * Outer whitespace is trimmed, and only outer whitespace: `"3 500 000"` is rejected. A space is a
 * legal group separator in several locales and in typed input, which is exactly why it is ambiguous
 * here — the app formats with dots, `formatVndPlain` emits dots, and accepting a second separator
 * would mean guessing which one the manager meant. Trimming is free (`paste` and the DOM both add
 * it); interpreting it is not.
 *
 * Magnitude is deliberately not checked here: the column is `numeric(14,0)` and the backend owns
 * that bound (`parseAmount` answers `VALIDATION_ERROR`), and returning `null` for "too large" would
 * be indistinguishable from "not an amount".
 */
export function parseVndDigits(input: string): VndString | null {
  const trimmed = input.trim();
  if (!AMOUNT.test(trimmed)) return null;
  return trimmed.replace(DOTS, "").replace(LEADING_ZEROS, "");
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
