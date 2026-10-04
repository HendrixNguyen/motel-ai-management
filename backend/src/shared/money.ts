import { AppError } from "./errors";

const VND = /^\d+$/;

export function parseVnd(input: string | number): string {
  const raw = typeof input === "number" ? String(input) : input.trim();
  if (!VND.test(raw))
    throw AppError.badRequest(`Số tiền không hợp lệ: ${input}`);
  return BigInt(raw).toString();
}

export function formatVnd(amount: string): string {
  return `${BigInt(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫`;
}

export function sumVnd(...amounts: string[]): string {
  return amounts
    .reduce((total, amount) => total + BigInt(parseVnd(amount)), 0n)
    .toString();
}
