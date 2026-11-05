import { serverGet } from "./server";
import type {
  BillingPeriodDetailResponse,
  BillingPeriodResponse,
  InvoiceResponse,
  MonthlyUtilityReport,
} from "./types";

const periodsPath = (motelId: string) =>
  `/api/manager/motels/${encodeURIComponent(motelId)}/billing/periods`;

export function listBillingPeriods(motelId: string): Promise<BillingPeriodResponse[]> {
  return serverGet(periodsPath(motelId));
}

export function getBillingPeriod(
  motelId: string,
  periodId: string,
): Promise<BillingPeriodDetailResponse> {
  return serverGet(`${periodsPath(motelId)}/${encodeURIComponent(periodId)}`);
}

export function listInvoices(motelId: string, periodId: string): Promise<InvoiceResponse[]> {
  return serverGet(`${periodsPath(motelId)}/${encodeURIComponent(periodId)}/invoices`);
}

const monthPath = (motelId: string, year: number, month: number) =>
  `/api/manager/motels/${encodeURIComponent(motelId)}/billing/months/${year}/${month}`;

export function getMonthlyUtilityReport(
  motelId: string,
  year: number,
  month: number,
): Promise<MonthlyUtilityReport> {
  return serverGet(`${monthPath(motelId, year, month)}/report`);
}
