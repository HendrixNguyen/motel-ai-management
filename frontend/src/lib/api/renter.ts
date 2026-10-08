import { apiGet, apiSend } from "./client";
import type { CreateRenterTicketInput, RenterContract, RenterInvoice, RenterPeriod, RenterPortalProfile, RenterTicket } from "./types";

export function exchangeRenterMagicLink(token: string) { return apiSend<{ renterId: string; motelId: string }>("/api/renter/magic-links/exchange", "POST", { token }); }
export function logoutRenter() { return apiSend<void>("/api/renter/logout", "POST"); }
export function getRenterMe() { return apiGet<RenterPortalProfile>("/api/renter/me"); }
export function listRenterPeriods() { return apiGet<RenterPeriod[]>("/api/renter/billing/periods"); }
export function listRenterInvoices(periodId: string) { return apiGet<RenterInvoice[]>(`/api/renter/billing/periods/${encodeURIComponent(periodId)}/invoices`); }
export function getRenterInvoice(invoiceId: string) { return apiGet<RenterInvoice>(`/api/renter/invoices/${encodeURIComponent(invoiceId)}`); }
export function getRenterContract(contractId?: string) { return apiGet<RenterContract>(contractId ? `/api/renter/contracts/${encodeURIComponent(contractId)}` : "/api/renter/contract"); }
export function requestRenterContractOtp(contractId: string) { return apiSend<{ sentAt: string }>(`/api/renter/contracts/${encodeURIComponent(contractId)}/sign-request`, "POST"); }
export function verifyRenterContractOtp(contractId: string, otp: string) { return apiSend<{ otpSignedAt: string }>(`/api/renter/contracts/${encodeURIComponent(contractId)}/verify`, "POST", { otp }); }
export function listRenterTickets() { return apiGet<RenterTicket[]>("/api/renter/tickets"); }
export function createRenterTicket(input: CreateRenterTicketInput) {
  if (!input.photos?.length) return apiSend<RenterTicket>("/api/renter/tickets", "POST", { category: input.category, description: input.description });
  const form = new FormData(); form.set("category", input.category); form.set("description", input.description); input.photos.forEach((photo) => form.append("photos", photo));
  return apiSend<RenterTicket>("/api/renter/tickets", "POST", form);
}
