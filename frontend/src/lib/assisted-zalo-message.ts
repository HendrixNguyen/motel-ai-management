import { formatVnd } from "@/lib/format/vnd";
import type { InvoiceResponse, RenterResponse } from "@/lib/api/types";

export function buildAssistedZaloMessage(input: {
  renter: Pick<RenterResponse, "phone">;
  invoice: Pick<InvoiceResponse, "roomName" | "totalAmount">;
  month: number;
  year: number;
  portalUrl: string;
}): { text: string; url: string } {
  const phone = input.renter.phone.startsWith("84")
    ? `0${input.renter.phone.slice(2)}`
    : input.renter.phone;
  return {
    text: `Hóa đơn phòng ${input.invoice.roomName} tháng ${String(input.month).padStart(2, "0")}/${input.year}: ${formatVnd(input.invoice.totalAmount)}. Xem chi tiết và thanh toán: ${input.portalUrl}`,
    url: `https://zalo.me/${encodeURIComponent(phone)}`,
  };
}
