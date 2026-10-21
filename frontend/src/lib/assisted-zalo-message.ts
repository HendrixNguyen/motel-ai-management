import { formatVnd } from "@/lib/format/vnd";

export function buildAssistedZaloMessage(input: { phone: string; roomName: string; month: number; year: number; totalAmount: string; portalUrl: string }): { text: string; url: string } {
  const phone = input.phone.startsWith("84") ? `0${input.phone.slice(2)}` : input.phone;
  return {
    text: `Hóa đơn phòng ${input.roomName} tháng ${String(input.month).padStart(2, "0")}/${input.year}: ${formatVnd(input.totalAmount)}. Xem chi tiết và thanh toán: ${input.portalUrl}`,
    url: `https://zalo.me/${encodeURIComponent(phone)}`,
  };
}
