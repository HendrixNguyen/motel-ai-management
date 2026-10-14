import { AppError } from "@/shared/errors";
import { parseAmount, sumVnd, type VndString } from "@/shared/money";

const MAX_METER_HUNDREDTHS = 999999999999n;

export interface InvoiceCalculationInput {
  electricity: { previous: string; current: string; unitPrice: string };
  water: { previous: string; current: string; unitPrice: string };
  rentAmount: string;
  otherFees: Array<{ name: string; amount: string }>;
}

export interface InvoiceCalculation {
  electricityUsage: string;
  electricityCost: VndString;
  waterUsage: string;
  waterCost: VndString;
  rentAmount: VndString;
  otherFeesTotal: VndString;
  totalAmount: VndString;
}

export function parseMeterValue(input: string): bigint {
  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) {
    throw AppError.badRequest(`Chỉ số công tơ không hợp lệ: ${input}`);
  }
  const [whole = "", fraction = ""] = input.split(".");
  const value = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
  if (value > MAX_METER_HUNDREDTHS) {
    throw AppError.badRequest(`Chỉ số công tơ vượt giới hạn: ${input}`);
  }
  return value;
}

export function formatMeterValue(hundredths: bigint): string {
  if (hundredths < 0n || hundredths > MAX_METER_HUNDREDTHS) {
    throw AppError.badRequest("Chỉ số công tơ không hợp lệ");
  }
  const whole = hundredths / 100n;
  const fraction = hundredths % 100n;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(2, "0").replace(/0$/, "")}`;
}

export function calculateUsage(previous: string, current: string): string {
  const before = parseMeterValue(previous);
  const after = parseMeterValue(current);
  if (after < before) throw AppError.badRequest("Chỉ số mới không được nhỏ hơn chỉ số cũ");
  return formatMeterValue(after - before);
}

export function calculateUtilityCost(usage: string, unitPrice: string): VndString {
  const hundredths = parseMeterValue(usage);
  const price = BigInt(parseAmount(unitPrice));
  return parseAmount(((hundredths * price + 50n) / 100n).toString());
}

export function calculateInvoiceAmounts(input: InvoiceCalculationInput): InvoiceCalculation {
  const electricityUsage = calculateUsage(input.electricity.previous, input.electricity.current);
  const waterUsage = calculateUsage(input.water.previous, input.water.current);
  const electricityCost = calculateUtilityCost(electricityUsage, input.electricity.unitPrice);
  const waterCost = calculateUtilityCost(waterUsage, input.water.unitPrice);
  const rentAmount = parseAmount(input.rentAmount);
  const otherFeesTotal = sumVnd(...input.otherFees.map((fee) => parseAmount(fee.amount)));
  const totalAmount = parseAmount(sumVnd(rentAmount, electricityCost, waterCost, otherFeesTotal));
  return { electricityUsage, electricityCost, waterUsage, waterCost, rentAmount, otherFeesTotal, totalAmount };
}
