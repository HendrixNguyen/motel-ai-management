import { AppError } from "./errors";

const VND = /^\d+$/;

/**
 * Digits `numeric(14,0)` holds: the largest storable amount is `10^14 - 1`.
 *
 * Declared here, beside the gate below, because the amount columns and the gate that protects
 * them must read the same number — a bound declared in one module and enforced in another is a
 * bound that can drift. Verified against PostgreSQL: `numeric_precision = 14, numeric_scale = 0`
 * for `motels.electricity_price`, `motels.water_price` and `rooms.base_price`.
 */
export const MONEY_PRECISION = 14;

/** Largest amount `numeric(14,0)` holds. `MONEY_PRECISION` digits of `9`. */
const MAX_AMOUNT = 10n ** BigInt(MONEY_PRECISION) - 1n;

export function parseVnd(input: string | number): string {
  const raw = typeof input === "number" ? String(input) : input.trim();
  if (!VND.test(raw))
    throw AppError.badRequest(`Số tiền không hợp lệ: ${input}`);
  return BigInt(raw).toString();
}

/**
 * The only way an amount reaches a `numeric(14,0)` money column.
 *
 * `parseVnd` is the digits-only gate; the magnitude check is on top of it, because digits are
 * not enough. `t.String()` in a route schema and `parseVnd` both accept `"999999999999999"`,
 * and PostgreSQL answers that with `numeric field overflow` (SQLSTATE 22003) — a driver error
 * the shared handler can only report as a 500, for what is plainly a client mistake.
 *
 * The value compared is `parseVnd`'s normalised output, so leading zeros can neither smuggle an
 * oversized amount past the bound nor trip it: `"09999999999999"` is 14 digits and fits.
 *
 * `input` is a `string`, not `string | number`, so a JSON float cannot be handed over at all —
 * the route schema rejects it and this signature would not accept it.
 *
 * Every money input goes through here — motel prices and `otherFees` amounts, a room's
 * `basePrice`, on create and on update — because a bound that one path enforces and another
 * ignores is worse than no bound at all.
 */
export function parseAmount(input: string): string {
  const amount = parseVnd(input);
  if (BigInt(amount) > MAX_AMOUNT) {
    throw AppError.badRequest(`Số tiền vượt quá ${MONEY_PRECISION} chữ số`);
  }
  return amount;
}

export function formatVnd(amount: string): string {
  return `${BigInt(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫`;
}

export function sumVnd(...amounts: string[]): string {
  return amounts
    .reduce((total, amount) => total + BigInt(parseVnd(amount)), 0n)
    .toString();
}
