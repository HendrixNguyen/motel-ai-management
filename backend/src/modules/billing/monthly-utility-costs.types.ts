export interface MonthlyUtilityCostInput {
  electricityAmount: string | null;
  waterAmount: string | null;
  electricityNotes: string | null;
  waterNotes: string | null;
}

export interface MonthlyUtilityReport {
  motelId: string;
  year: number;
  month: number;
  periodStatus: "draft" | "sent" | "closed" | null;
  costs: MonthlyUtilityCostInput;
  electricity: {
    billed: string;
    collected: string;
    cost: string | null;
    billedDifference: string | null;
    collectedDifference: string | null;
  };
  water: {
    billed: string;
    collected: string;
    cost: string | null;
    billedDifference: string | null;
    collectedDifference: string | null;
  };
  utilities: {
    billed: string;
    collected: string;
    cost: string | null;
    billedDifference: string | null;
    collectedDifference: string | null;
  };
  totals: {
    billed: string;
    collected: string;
    outstanding: string;
    billedLessUtilityCosts: string | null;
    collectedLessUtilityCosts: string | null;
  };
}

export interface MonthlyUtilityCostResponse extends MonthlyUtilityCostInput {
  motelId: string;
  year: number;
  month: number;
}
