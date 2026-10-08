import { hasRenterInvoicePeriod, listRenterInvoicesForPeriod, listBillingPeriodsForRenter, getRenterInvoiceDetail } from "@/modules/billing/billing.service";
import { db } from "@/db";
import { getRoomForRenter } from "@/modules/room/room.service";
import { getMotelForRenter } from "@/modules/motel/motel.service";

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
  const detail = await getRenterInvoiceDetail(session.renterId, session.motelId, invoiceId);
  if (!detail) throw AppError.notFound("Không tìm thấy hóa đơn");
  const motel = await getMotelForRenter(session.motelId);
  return { ...detail, bankAccount: motel?.bankAccount ?? null };
}
