import { AppError } from "@/shared/errors";
import { parseAmount } from "@/shared/money";
import type { VietQrInput } from "./vietqr.types";

const UNSUPPORTED = /[^A-Za-z0-9 ./-]/g;

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, (char) => char === "Đ" ? "D" : "d").replace(UNSUPPORTED, " ").replace(/\s+/g, " ").trim();
}

export function buildTransferDescription(input: { motelName: string; month: number; year: number; roomName: string }): string {
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12 || !Number.isInteger(input.year)) throw AppError.badRequest("Tháng hoặc năm không hợp lệ");
  const suffix = `T${input.month}/${input.year} P${normalizeText(input.roomName)}`;
  const roomSuffix = `T${input.month}/${input.year} P`;
  const maxMotel = Math.max(0, 25 - suffix.length);
  const motel = normalizeText(input.motelName).slice(0, maxMotel).trim();
  let result = `${motel} ${suffix}`.trim();
  if (result.length <= 25) return result;
  const roomMax = Math.max(0, 25 - roomSuffix.length);
  return `${roomSuffix}${normalizeText(input.roomName).slice(0, roomMax).trim()}`.slice(0, 25).trim();
}

function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(input: string): string {
  let crc = 0xffff;
  for (const char of input) {
    crc ^= char.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildVietQrPayload(input: VietQrInput): string {
  if (!/^\d{6}$/.test(input.bankBin)) throw AppError.badRequest("Mã BIN ngân hàng không hợp lệ");
  if (!/^\d{6,19}$/.test(input.accountNumber)) throw AppError.badRequest("Số tài khoản không hợp lệ");
  const amount = parseAmount(input.amount);
  if (!/^\d{1,13}$/.test(amount)) throw AppError.badRequest("Số tiền VietQR không hợp lệ");
  const description = normalizeText(input.description);
  if (!description || description.length > 25) throw AppError.badRequest("Nội dung chuyển khoản không hợp lệ");
  const beneficiary = tlv("00", "A000000727") + tlv("01", tlv("00", input.bankBin) + tlv("01", input.accountNumber)) + tlv("02", "QRIBFTTA");
  const payload = tlv("00", "01") + tlv("01", "12") + tlv("38", beneficiary) + tlv("53", "704") + tlv("54", amount) + tlv("58", "VN") + tlv("62", tlv("08", description)) + "6304";
  return payload + crc16(payload);
}
