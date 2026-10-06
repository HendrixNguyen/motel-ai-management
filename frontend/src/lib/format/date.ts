/**
 * Every date a manager or renter sees is resolved in the motel's timezone, not the viewer's and not
 * UTC. `Date` speaks UTC, so an instant at the end of a UTC day is already tomorrow in Vietnam —
 * a billing period that opens on the wrong day is the kind of off-by-one a renter disputes.
 *
 * There is deliberately **no due-date formatter**: invoices carry no due-date field
 * (`docs/frontend-ui-specs.md`, R1), so nothing here may display or imply a deadline.
 */
const TIME_ZONE = "Asia/Ho_Chi_Minh";

/**
 * `vi-VN` with the parts requested explicitly, then assembled as `DD/MM/YYYY` by hand.
 *
 * Requesting the parts (rather than formatting to a string) means the output order is this file's
 * decision, not the ICU data's: a locale-data change cannot silently reorder a date.
 */
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function partOf(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((candidate) => candidate.type === type)?.value ?? "";
}

/** `2026-02-28T17:00:00.000Z` → `01/03/2026`, because that instant is already 1 March in Vietnam. */
export function formatDate(iso: string): string {
  const parts = DAY_MONTH_YEAR.formatToParts(new Date(iso));
  return `${partOf(parts, "day")}/${partOf(parts, "month")}/${partOf(parts, "year")}`;
}

/**
 * `2026, 3` → `03/2026`, the sub-label on a billing period (`Tháng MM/YYYY`).
 *
 * `month` is 1-based, as in `Date.getMonth() + 1`. Takes no timestamp, so it cannot disagree with
 * `formatDate` about which month a period falls in.
 */
export function formatMonth(year: number, month: number): string {
  return `${String(month).padStart(2, "0")}/${year}`;
}
