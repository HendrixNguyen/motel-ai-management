import { formatVnd } from "@/lib/format/vnd";
import type { InvoiceResponse, RenterResponse } from "@/lib/api/types";

export function buildAssistedZaloMessage(input: {
  renter: Pick<RenterResponse, "zaloPhone">;
  invoice: Pick<InvoiceResponse, "roomName" | "totalAmount">;
  month: number;
  year: number;
  portalUrl: string;
}): { text: string; url: string } | null {
  if (!input.renter.zaloPhone) return null;
  const phone = input.renter.zaloPhone.startsWith("84")
    ? `0${input.renter.zaloPhone.slice(2)}`
    : input.renter.zaloPhone;
  return {
    text: `Hóa đơn phòng ${input.invoice.roomName} tháng ${String(input.month).padStart(2, "0")}/${input.year}: ${formatVnd(input.invoice.totalAmount)}. Xem chi tiết và thanh toán: ${input.portalUrl}`,
    url: `https://zalo.me/${encodeURIComponent(phone)}`,
  };
}
