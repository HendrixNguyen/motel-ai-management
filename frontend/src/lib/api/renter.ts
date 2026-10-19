import { apiGet, apiSend } from "./client";
import type { CreateRenterTicketInput, RenterContract, RenterInvoiceDetail, RenterInvoiceSummary, RenterPeriod, RenterPortalProfile, RenterPaymentProof, RenterTicket } from "./types";

export function exchangeRenterMagicLink(token: string) { return apiSend<{ renterId: string; motelId: string }>("/api/renter/magic-links/exchange", "POST", { token }); }
export function logoutRenter() { return apiSend<void>("/api/renter/logout", "POST"); }
export function getRenterMe() { return apiGet<RenterPortalProfile>("/api/renter/me"); }
export function getRenterPushKey() { return apiGet<{ publicKey: string | null; enabled: boolean }>("/api/renter/push/key"); }
export function getRenterPushSubscription() { return apiGet<{ subscription: { endpoint: string } | null }>("/api/renter/push/subscription"); }
export function saveRenterPushSubscription(subscription: PushSubscriptionJSON) { return apiSend<{ registered: boolean; subscriptionId: string }>("/api/renter/push/subscription", "POST", subscription); }
export function removeRenterPushSubscription(endpoint: string) { return apiSend<{ removed: boolean }>("/api/renter/push/subscription", "DELETE", { endpoint }); }
export function listRenterPeriods() { return apiGet<RenterPeriod[]>("/api/renter/billing/periods"); }
export function listRenterInvoices(periodId: string) { return apiGet<RenterInvoiceSummary[]>(`/api/renter/billing/periods/${encodeURIComponent(periodId)}/invoices`); }
export function getRenterInvoice(invoiceId: string) { return apiGet<RenterInvoiceDetail>(`/api/renter/invoices/${encodeURIComponent(invoiceId)}`); }
export function getRenterPaymentProof(invoiceId: string) { return apiGet<RenterPaymentProof | null>(`/api/renter/invoices/${encodeURIComponent(invoiceId)}/payment-proof`); }
export function submitRenterPaymentProof(invoiceId: string, file: File) { const form = new FormData(); form.set("file", file); return apiSend<RenterPaymentProof>(`/api/renter/invoices/${encodeURIComponent(invoiceId)}/payment-proof`, "POST", form); }
export function getRenterContract(contractId?: string) { return apiGet<RenterContract>(contractId ? `/api/renter/contracts/${encodeURIComponent(contractId)}` : "/api/renter/contract"); }
export function acceptRenterContractConsent(contractId: string, termsVersion: string) { return apiSend<RenterContract>(`/api/renter/contracts/${encodeURIComponent(contractId)}/consent`, "POST", { consent: true, termsVersion }); }
export function listRenterTickets() { return apiGet<RenterTicket[]>("/api/renter/tickets"); }
export function getRenterTicket(ticketId: string) { return apiGet<RenterTicket>(`/api/renter/tickets/${encodeURIComponent(ticketId)}`); }
export function createRenterTicket(input: CreateRenterTicketInput) {
  if (!input.photos?.length) return apiSend<RenterTicket>("/api/renter/tickets", "POST", { category: input.category, description: input.description });
  const form = new FormData(); form.set("category", input.category); form.set("description", input.description); input.photos.forEach((photo) => form.append("photos", photo));
  return apiSend<RenterTicket>("/api/renter/tickets", "POST", form);
}
