export type PaymentProofStatus = "pending" | "approved" | "rejected";

export interface PaymentProofResponse {
  id: string;
  invoiceId: string;
  status: PaymentProofStatus;
  contentType: "image/jpeg" | "image/png";
  size: number;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}
