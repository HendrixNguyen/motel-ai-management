import { apiSend } from "./client";
import type { BillingPeriodDetailResponse, BillingPeriodResponse, InvoiceGenerationResponse, InvoiceResponse, UpdateReadingsInput } from "./types";

const periodsPath = (motelId: string) => `/api/manager/motels/${encodeURIComponent(motelId)}/billing/periods`;

export function createBillingPeriod(motelId: string, body: { month: number; year: number }): Promise<BillingPeriodDetailResponse> {
  return apiSend(`${periodsPath(motelId)}`, "POST", body);
}

export function saveMeterReadings(motelId: string, periodId: string, body: UpdateReadingsInput): Promise<unknown> {
  return apiSend(`${periodsPath(motelId)}/${encodeURIComponent(periodId)}/readings`, "PUT", body);
}

export function generateInvoices(motelId: string, periodId: string): Promise<InvoiceGenerationResponse> {
  return apiSend(`${periodsPath(motelId)}/${encodeURIComponent(periodId)}/invoices`, "POST");
}

export function finalizeBillingPeriod(motelId: string, periodId: string): Promise<BillingPeriodResponse> {
  return apiSend(`${periodsPath(motelId)}/${encodeURIComponent(periodId)}/send`, "POST");
}

export function markInvoicePaid(motelId: string, invoiceId: string): Promise<InvoiceResponse> {
  return apiSend(`/api/manager/motels/${encodeURIComponent(motelId)}/billing/invoices/${encodeURIComponent(invoiceId)}/paid`, "PATCH");
}

export function markInvoiceOverdue(motelId: string, invoiceId: string): Promise<InvoiceResponse> {
  return apiSend(`/api/manager/motels/${encodeURIComponent(motelId)}/billing/invoices/${encodeURIComponent(invoiceId)}/overdue`, "PATCH");
}
