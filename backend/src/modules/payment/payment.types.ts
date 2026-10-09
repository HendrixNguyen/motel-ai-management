export type PaymentProofStatus = "pending" | "approved" | "rejected";

export interface PaymentProofResponse {
  id: string;
  invoiceId: string;
  status: PaymentProofStatus;
  contentType: "image/jpeg" | "image/png";
  size: number;
  submittedAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
}
