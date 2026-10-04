import { AppError } from "./errors";

const VN = /^(?:0|\+84|84)([235789]\d{8})$/;

export function normalisePhone(input: string): string {
  const digits = input.replace(/[\s.-]/g, "");
  const match = VN.exec(digits);
  if (!match) throw AppError.badRequest(`Số điện thoại không hợp lệ: ${input}`);
  return `84${match[1]}`;
}

export function formatPhone(input: string): string {
  const local = input.replace(/^84/, "0");
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}