const MAX_SCALED = BigInt("99999999999");
const HUNDRED = BigInt("100");
export function parseMeterInput(value: string): string | null {
  const text = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const parts = text.split(".");
  const whole = parts[0] ?? "";
  const fraction = parts[1] ?? "";
  const scaled = BigInt(whole) * HUNDRED + BigInt(fraction.padEnd(2, "0"));
  if (scaled > MAX_SCALED) return null;
  return `${scaled / HUNDRED}.${String(scaled % HUNDRED).padStart(2, "0")}`;
}
export function calculateMeterPreview(previous: string, current: string, unitPrice: string): { usage: string; cost: string } | null {
  const before = parseMeterInput(previous); const after = parseMeterInput(current);
  if (before === null || after === null) return null;
  const beforeScaled = BigInt(before.replace(".", "")); const afterScaled = BigInt(after.replace(".", ""));
  if (afterScaled < beforeScaled) return null;
  const usage = afterScaled - beforeScaled; const price = BigInt(unitPrice);
  return { usage: `${usage / HUNDRED}.${String(usage % HUNDRED).padStart(2, "0")}`, cost: ((usage * price + BigInt("50")) / HUNDRED).toString() };
}
