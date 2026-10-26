export const sample = {
  rent: 2_500_000,
  electricity: { previous: 1240, current: 1310, rate: 3500 },
  water: { previous: 80, current: 85, rate: 15_000 },
} as const;

export type Readings = { electricity: number; water: number };
export type BillLine = { used: number; rate: number; amount: number };
export type Bill = {
  rent: number;
  electricity: BillLine;
  water: BillLine;
  total: number;
};

export function calculateBill(readings: Readings): Bill {
  const electricityUsed = readings.electricity - sample.electricity.previous;
  const waterUsed = readings.water - sample.water.previous;
  const electricityAmount = electricityUsed * sample.electricity.rate;
  const waterAmount = waterUsed * sample.water.rate;
  const total = sample.rent + electricityAmount + waterAmount;

  if (
    !Number.isSafeInteger(readings.electricity) ||
    !Number.isSafeInteger(readings.water) ||
    electricityUsed < 0 ||
    waterUsed < 0 ||
    !Number.isSafeInteger(electricityAmount) ||
    !Number.isSafeInteger(waterAmount) ||
    !Number.isSafeInteger(total)
  ) {
    throw new RangeError(
      "Chỉ số phải là số nguyên an toàn, không thấp hơn kỳ trước.",
    );
  }

  return {
    rent: sample.rent,
    electricity: {
      used: electricityUsed,
      rate: sample.electricity.rate,
      amount: electricityAmount,
    },
    water: { used: waterUsed, rate: sample.water.rate, amount: waterAmount },
    total,
  };
}

export function validateReadings(electricity: string, water: string): Readings {
  if (electricity.trim() === "" || water.trim() === "") {
    throw new RangeError("Nhập đủ chỉ số điện và nước.");
  }

  const readings = { electricity: Number(electricity), water: Number(water) };
  calculateBill(readings);
  return readings;
}
