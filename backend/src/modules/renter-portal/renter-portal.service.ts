import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { billingPeriods, invoices } from "@/modules/billing/billing.schema";
import { rooms } from "@/modules/room/room.schema";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { getActiveContractForRenter } from "@/modules/contract/contract.service";
import { AppError } from "@/shared/errors";
import type { RenterSession, RenterPortalProfile, RenterPeriod, RenterInvoice } from "./renter-portal.types";

export async function getRenterMe(session: RenterSession): Promise<RenterPortalProfile> {
  const row = await db.select({ renter: renters, motel: motels, room: rooms })
    .from(renters).innerJoin(motels, eq(renters.motelId, motels.id)).leftJoin(rooms, eq(renters.roomId, rooms.id))
    .where(and(eq(renters.id, session.renterId), eq(renters.motelId, session.motelId))).limit(1);
  const found = row[0];
  if (!found) throw AppError.notFound("Không tìm thấy người thuê");
  return {
    id: found.renter.id,
    name: found.renter.name,
    phone: found.renter.phone,
    room: found.room ? { id: found.room.id, name: found.room.name, floor: found.room.floor } : null,
    motel: { id: found.motel.id, name: found.motel.name },
    activeContract: await getActiveContractForRenter(found.renter.id, found.motel.id),
  };
}

export async function listRenterPeriods(session: RenterSession): Promise<RenterPeriod[]> {
  const rows = await db.query.billingPeriods.findMany({ where: eq(billingPeriods.motelId, session.motelId), orderBy: [desc(billingPeriods.year), desc(billingPeriods.month), desc(billingPeriods.id)] });
  return rows.map((row) => ({ id: row.id, month: row.month, year: row.year, status: row.status, createdAt: row.createdAt.toISOString() }));
}

export async function listRenterInvoices(session: RenterSession, periodId: string): Promise<RenterInvoice[]> {
  const period = await db.query.billingPeriods.findFirst({ where: and(eq(billingPeriods.id, periodId), eq(billingPeriods.motelId, session.motelId)) });
  if (!period) throw AppError.notFound("Không tìm thấy kỳ hóa đơn");
  const rows = await db.select({ invoice: invoices, roomName: rooms.name })
    .from(invoices).innerJoin(rooms, eq(invoices.roomId, rooms.id))
    .where(and(eq(invoices.renterId, session.renterId), eq(invoices.motelId, session.motelId), eq(invoices.billingPeriodId, periodId)))
    .orderBy(asc(rooms.name), asc(invoices.id));
  return rows.map(({ invoice, roomName }) => ({ id: invoice.id, billingPeriodId: invoice.billingPeriodId, month: period.month, year: period.year, roomId: invoice.roomId, roomName, rentAmount: invoice.rentAmount, electricityUsage: invoice.electricityUsage, electricityCost: invoice.electricityCost, waterUsage: invoice.waterUsage, waterCost: invoice.waterCost, otherFees: invoice.otherFees, totalAmount: invoice.totalAmount, qrCodeData: invoice.qrCodeData, paymentStatus: invoice.paymentStatus, paidAt: invoice.paidAt?.toISOString() ?? null, createdAt: invoice.createdAt.toISOString() }));
}
