import { hasRenterInvoicePeriod, listRenterInvoicesForPeriod, listBillingPeriodsForRenter, type RenterInvoiceProjection } from "@/modules/billing/billing.service";
import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { invoices, billingPeriods, meterReadings } from "@/modules/billing/billing.schema";
import { uploads } from "@/modules/billing/upload.schema";
import { getRoomForRenter } from "@/modules/room/room.service";
import { getMotelForRenter } from "@/modules/motel/motel.service";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { getRenter } from "@/modules/renter/renter.service";
import { getActiveContractForRenter } from "@/modules/contract/contract.service";
import { AppError } from "@/shared/errors";
import type { RenterSession, RenterPortalProfile, RenterPeriod, RenterInvoice } from "./renter-portal.types";

export async function getRenterMe(session: RenterSession): Promise<RenterPortalProfile> {
  const renter = await getRenter(session.renterId);
  if (!renter || renter.motelId !== session.motelId) throw AppError.notFound("Không tìm thấy người thuê");
  const motel = await getMotelForRenter(session.motelId);
  if (!motel) throw AppError.notFound("Không tìm thấy nhà trọ");
  const room = renter.roomId ? await getRoomForRenter(renter.roomId, session.motelId) : null;
  return {
    id: renter.id,
    name: renter.name,
    phone: renter.phone,
    room,
    motel,
    activeContract: await getActiveContractForRenter(renter.id, session.motelId),
  };
}

export async function listRenterPeriods(session: RenterSession): Promise<RenterPeriod[]> {
  return listBillingPeriodsForRenter(session.motelId, session.renterId);
}

export async function listRenterInvoices(session: RenterSession, periodId: string): Promise<RenterInvoice[]> {
  if (!(await hasRenterInvoicePeriod(session.renterId, session.motelId, periodId))) throw AppError.notFound("Không tìm thấy kỳ hóa đơn");
  return listRenterInvoicesForPeriod(session.renterId, session.motelId, periodId);
}

export async function getRenterInvoice(session: RenterSession, invoiceId: string): Promise<RenterInvoice> {
  const row = await db.select({ invoice: invoices, roomName: rooms.name, month: billingPeriods.month, year: billingPeriods.year, bankAccount: motels.bankAccount }).from(invoices).innerJoin(billingPeriods, and(eq(billingPeriods.id, invoices.billingPeriodId), eq(billingPeriods.motelId, session.motelId))).innerJoin(motels, eq(motels.id, invoices.motelId)).innerJoin(rooms, eq(rooms.id, invoices.roomId)).where(and(eq(invoices.id, invoiceId), eq(invoices.renterId, session.renterId), eq(invoices.motelId, session.motelId))).limit(1);
  const item = row[0]; if (!item) throw AppError.notFound("Không tìm thấy hóa đơn");
  const readings = await db.select({ type: meterReadings.type, capturedAt: meterReadings.readingDate, objectKey: uploads.objectKey }).from(meterReadings).leftJoin(uploads, and(eq(uploads.resourceType, "meter_reading"), eq(uploads.resourceId, meterReadings.id))).where(and(eq(meterReadings.billingPeriodId, item.invoice.billingPeriodId), eq(meterReadings.roomId, item.invoice.roomId)));
  return { id: item.invoice.id, billingPeriodId: item.invoice.billingPeriodId, month: item.month, year: item.year, roomId: item.invoice.roomId, roomName: item.roomName, rentAmount: item.invoice.rentAmount, electricityUsage: item.invoice.electricityUsage, electricityCost: item.invoice.electricityCost, waterUsage: item.invoice.waterUsage, waterCost: item.invoice.waterCost, otherFees: item.invoice.otherFees, totalAmount: item.invoice.totalAmount, qrCodeData: item.invoice.qrCodeData, paymentStatus: item.invoice.paymentStatus, paidAt: item.invoice.paidAt?.toISOString() ?? null, createdAt: item.invoice.createdAt.toISOString(), bankAccount: item.bankAccount, transferDescription: `Thanh toán tháng ${item.month}/${item.year}`, meterPhotos: readings.filter((reading) => reading.objectKey).map((reading) => ({ type: reading.type, signedUrl: `/api/renter/photos/${reading.objectKey}`, capturedAt: reading.capturedAt })) };
}
