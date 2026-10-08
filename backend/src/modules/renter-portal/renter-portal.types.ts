import type { RenterAuthPayload } from "@/middleware/renter-auth";
import type { VndString } from "@/shared/money";

export interface RenterSession extends RenterAuthPayload {}

export interface RenterPortalProfile {
  id: string;
  name: string;
  phone: string;
  room: { id: string; name: string; floor: number | null } | null;
  motel: { id: string; name: string };
  activeContract: {
    id: string;
    roomId: string;
    roomName: string;
    startDate: string;
    endDate: string;
    monthlyRent: VndString;
  } | null;
}

export interface RenterPeriod {
  id: string;
  month: number;
  year: number;
  status: "draft" | "sent" | "closed";
  createdAt: string;
}

export interface RenterInvoice {
  id: string;
  billingPeriodId: string;
  month: number;
  year: number;
  roomId: string;
  roomName: string;
  rentAmount: VndString;
  electricityUsage: string;
  electricityCost: VndString;
  waterUsage: string;
  waterCost: VndString;
  otherFees: unknown[];
  totalAmount: VndString;
  qrCodeData: string | null;
  paymentStatus: "unpaid" | "paid" | "overdue";
  paidAt: string | null;
  createdAt: string;
}
