import { apiGet, apiSend } from "./client";
import type { BillingPeriodDetailResponse, BillingPeriodResponse, InvoiceGenerationResponse, InvoicePaymentResult, InvoiceResponse, ManagerPaymentProof, PaymentProof, UpdateReadingsInput } from "./types";

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

const invoicePath = (motelId: string, invoiceId: string) => `/api/manager/motels/${encodeURIComponent(motelId)}/billing/invoices/${encodeURIComponent(invoiceId)}`;

export function getManagerPaymentProof(motelId: string, invoiceId: string): Promise<ManagerPaymentProof | null> {
  return apiGet(`${invoicePath(motelId, invoiceId)}/payment-proof`);
}

export function approvePaymentProof(motelId: string, invoiceId: string): Promise<InvoicePaymentResult> {
  return apiSend(`${invoicePath(motelId, invoiceId)}/payment-proof/approve`, "POST");
}

export function rejectPaymentProof(motelId: string, invoiceId: string, reason: string): Promise<PaymentProof> {
  if (!reason.trim()) return Promise.reject(new Error("Vui lòng nhập lý do từ chối."));
  return apiSend(`${invoicePath(motelId, invoiceId)}/payment-proof/reject`, "POST", { reason: reason.trim() });
}

export function confirmInvoiceCash(motelId: string, invoiceId: string): Promise<InvoicePaymentResult> {
  return apiSend(`${invoicePath(motelId, invoiceId)}/cash-confirmation`, "POST");
}

export function markInvoiceOverdue(motelId: string, invoiceId: string): Promise<InvoiceResponse> {
  return apiSend(`/api/manager/motels/${encodeURIComponent(motelId)}/billing/invoices/${encodeURIComponent(invoiceId)}/overdue`, "PATCH");
}
