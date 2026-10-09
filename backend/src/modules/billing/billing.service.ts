import { and, asc, desc, eq, inArray, or, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { type VndString } from "@/shared/money";
import { billingPeriods, meterReadings, invoices } from "./billing.schema";
import { resolveOwnedMotel } from "@/middleware/tenancy";
import { AppError } from "@/shared/errors";
import { listRoomsForBilling } from "@/modules/room/room.service";
import { type BillingPeriodDetailResponse, type BillingPeriodResponse, type CreateBillingPeriodInput, type InvoiceGenerationResponse, type InvoiceResponse, type MeterReadingResponse, type UpdateReadingsInput, type SignedUploadResponse, type UploadResponse } from "./billing.types";
import { uploads } from "./upload.schema";
import { FakeStorageAdapter, StorageError, type StorageAdapter, validateStorageInput } from "@/shared/storage";

let uploadStorage: StorageAdapter = new FakeStorageAdapter();
export function configureUploadStorage(storage: StorageAdapter): void { uploadStorage = storage; }
import { listBillableContractsForMotel } from "@/modules/contract/contract.service";
import { calculateInvoiceAmounts } from "./billing.calculation";
import { buildTransferDescription, buildVietQrPayload } from "@/modules/vietqr/vietqr.service";
import { parseMeterValue, formatMeterValue } from "./billing.calculation";
import { enqueueNotification } from "@/modules/notification/notification.service";

function periodResponse(row: typeof billingPeriods.$inferSelect): BillingPeriodResponse {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export interface RenterInvoiceProjection { id: string; billingPeriodId: string; month: number; year: number; roomId: string; roomName: string; rentAmount: string; electricityUsage: string; electricityCost: string; waterUsage: string; waterCost: string; otherFees: unknown[]; totalAmount: string; qrCodeData: string | null; paymentStatus: "unpaid" | "paid" | "overdue"; paymentMethod: "bank_transfer" | "cash" | null; paidAt: string | null; createdAt: string }
export interface RenterInvoiceDetailProjection extends RenterInvoiceProjection { bankAccount: { bankCode: string; accountNumber: string; accountName: string } | null; transferDescription: string; meterPhotos: Array<{ type: "electric" | "water"; signedUrl: string; capturedAt: string | null }> }

export async function hasRenterInvoicePeriod(renterId: string, motelId: string, periodId: string): Promise<boolean> {
  const row = await db.select({ id: invoices.id }).from(invoices).innerJoin(billingPeriods, and(eq(billingPeriods.id, invoices.billingPeriodId), eq(billingPeriods.motelId, motelId))).where(and(eq(invoices.renterId, renterId), eq(invoices.motelId, motelId), eq(invoices.billingPeriodId, periodId))).limit(1);
  return row.length > 0;
}

export async function getRenterInvoiceDetail(renterId: string, motelId: string, invoiceId: string) {
  const row = await db.select({ invoice: invoices, month: billingPeriods.month, year: billingPeriods.year }).from(invoices).innerJoin(billingPeriods, and(eq(billingPeriods.id, invoices.billingPeriodId), eq(billingPeriods.motelId, motelId))).where(and(eq(invoices.id, invoiceId), eq(invoices.renterId, renterId), eq(invoices.motelId, motelId))).limit(1);
  const item = row[0]; if (!item) return null;
  const room = (await listRoomsForBilling(motelId)).find((candidate) => candidate.id === item.invoice.roomId); if (!room) return null;
  const readings = await db.select({ type: meterReadings.type, capturedAt: meterReadings.readingDate, objectKey: uploads.objectKey }).from(meterReadings).leftJoin(uploads, and(eq(uploads.resourceType, "meter_reading"), eq(uploads.resourceId, meterReadings.id))).where(and(eq(meterReadings.billingPeriodId, item.invoice.billingPeriodId), eq(meterReadings.roomId, item.invoice.roomId)));
  const meterPhotos = await Promise.all(readings.filter((reading) => reading.objectKey).map(async (reading) => ({ type: reading.type, signedUrl: await uploadStorage.createSignedDownload(reading.objectKey!, 300), capturedAt: reading.capturedAt })));
  return { id: item.invoice.id, billingPeriodId: item.invoice.billingPeriodId, month: item.month, year: item.year, roomId: item.invoice.roomId, roomName: room.name, rentAmount: item.invoice.rentAmount, electricityUsage: item.invoice.electricityUsage, electricityCost: item.invoice.electricityCost, waterUsage: item.invoice.waterUsage, waterCost: item.invoice.waterCost, otherFees: item.invoice.otherFees, totalAmount: item.invoice.totalAmount, qrCodeData: item.invoice.qrCodeData, paymentStatus: item.invoice.paymentStatus, paymentMethod: item.invoice.paymentMethod, paidAt: item.invoice.paidAt?.toISOString() ?? null, createdAt: item.invoice.createdAt.toISOString(), transferDescription: `Thanh toán tháng ${item.month}/${item.year}`, meterPhotos };
}

export async function listRenterInvoicesForPeriod(renterId: string, motelId: string, periodId: string): Promise<RenterInvoiceProjection[]> {
  const rows = await db.select({ invoice: invoices, month: billingPeriods.month, year: billingPeriods.year }).from(invoices).innerJoin(billingPeriods, and(eq(billingPeriods.id, invoices.billingPeriodId), eq(billingPeriods.motelId, motelId))).where(and(eq(invoices.renterId, renterId), eq(invoices.motelId, motelId), eq(invoices.billingPeriodId, periodId))).orderBy(asc(invoices.id));
  const rooms = await listRoomsForBilling(motelId);
  return rows.map(({ invoice, month, year }) => ({ id: invoice.id, billingPeriodId: invoice.billingPeriodId, month, year, roomId: invoice.roomId, roomName: rooms.find((room) => room.id === invoice.roomId)?.name ?? "", rentAmount: invoice.rentAmount, electricityUsage: invoice.electricityUsage, electricityCost: invoice.electricityCost, waterUsage: invoice.waterUsage, waterCost: invoice.waterCost, otherFees: invoice.otherFees, totalAmount: invoice.totalAmount, qrCodeData: invoice.qrCodeData, paymentStatus: invoice.paymentStatus, paymentMethod: invoice.paymentMethod, paidAt: invoice.paidAt?.toISOString() ?? null, createdAt: invoice.createdAt.toISOString() }));
}

export async function listBillingPeriodsForRenter(motelId: string, renterId: string): Promise<BillingPeriodResponse[]> {
  const rows = await db.select({ period: billingPeriods }).from(billingPeriods).innerJoin(invoices, and(eq(invoices.billingPeriodId, billingPeriods.id), eq(invoices.renterId, renterId), eq(invoices.motelId, motelId))).where(eq(billingPeriods.motelId, motelId)).orderBy(desc(billingPeriods.year), desc(billingPeriods.month), desc(billingPeriods.id));
  const seen = new Set<string>();
  return rows.flatMap(({ period }) => {
    if (seen.has(period.id)) return [];
    seen.add(period.id);
    return [periodResponse(period)];
  });
}

export async function listBillingPeriods(motelId: string, managerId: string): Promise<BillingPeriodResponse[]> {
  await resolveOwnedMotel(motelId, managerId);
  const rows = await db.query.billingPeriods.findMany({ where: eq(billingPeriods.motelId, motelId), orderBy: [desc(billingPeriods.year), desc(billingPeriods.month), desc(billingPeriods.id)] });
  return rows.map(periodResponse);
}

export async function createBillingPeriod(motelId: string, managerId: string, input: CreateBillingPeriodInput): Promise<BillingPeriodDetailResponse> {
  await resolveOwnedMotel(motelId, managerId);
  if (input.month < 1 || input.month > 12) throw AppError.badRequest("Tháng không hợp lệ");
  try {
    const period = await db.transaction(async (tx) => {
      const [created] = await tx.insert(billingPeriods).values({ motelId, month: input.month, year: input.year }).returning();
      if (!created) throw AppError.conflict("Không thể tạo kỳ hóa đơn");
      const roomRows = await listRoomsForBilling(motelId, tx);
      const roomIds = roomRows.map((room) => room.id);
      const prior = roomIds.length ? await tx.select({ reading: meterReadings, year: billingPeriods.year, month: billingPeriods.month }).from(meterReadings).innerJoin(billingPeriods, eq(meterReadings.billingPeriodId, billingPeriods.id)).where(and(inArray(meterReadings.roomId, roomIds), or(lt(billingPeriods.year, input.year), and(eq(billingPeriods.year, input.year), lt(billingPeriods.month, input.month))))) : [];
      const values = roomRows.flatMap((room) => (["electric", "water"] as const).map((type) => {
        const latest = prior.filter((entry) => entry.reading.roomId === room.id && entry.reading.type === type).sort((a, b) => (b.year - a.year) || (b.month - a.month) || (b.reading.createdAt.getTime() - a.reading.createdAt.getTime()))[0];
        return { billingPeriodId: created.id, roomId: room.id, type, previousReading: latest?.reading.currentReading ?? "0.00" };
      }));
      if (values.length) await tx.insert(meterReadings).values(values);
      return created;
    });
    return getBillingPeriod(period.id, motelId, managerId);
  } catch (error) {
    const driver = ((error as { cause?: { constraint_name?: string } }).cause ?? error) as { constraint_name?: string };
    if (driver.constraint_name === "billing_periods_motel_month_year_uq") throw AppError.conflict("Kỳ hóa đơn đã tồn tại");
    throw error;
  }
}

export async function getBillingPeriod(periodId: string, motelId: string, managerId: string): Promise<BillingPeriodDetailResponse> {
  await resolveOwnedMotel(motelId, managerId);
  const period = await db.query.billingPeriods.findFirst({ where: and(eq(billingPeriods.id, periodId), eq(billingPeriods.motelId, motelId)) });
  if (!period) throw AppError.notFound("Không tìm thấy kỳ hóa đơn");
  const rooms = await listRoomsForBilling(motelId);
  const readings = await db.query.meterReadings.findMany({ where: eq(meterReadings.billingPeriodId, periodId), orderBy: [asc(meterReadings.type), asc(meterReadings.id)] });
  return { ...periodResponse(period), rooms: rooms.map((room) => ({ ...room, readings: readings.filter((reading) => reading.roomId === room.id).map((reading) => ({ id: reading.id, roomId: reading.roomId, type: reading.type, previousReading: reading.previousReading, currentReading: reading.currentReading, readingDate: reading.readingDate, updatedAt: reading.updatedAt.toISOString() })) })) };
}

export async function updateMeterReadings(periodId: string, motelId: string, managerId: string, input: UpdateReadingsInput): Promise<MeterReadingResponse[]> {
  await resolveOwnedMotel(motelId, managerId);
  if (!input.readings.length) throw AppError.badRequest("Danh sách chỉ số không được trống");
  return db.transaction(async (tx) => {
    const period = await tx.query.billingPeriods.findFirst({ where: and(eq(billingPeriods.id, periodId), eq(billingPeriods.motelId, motelId)) });
    if (!period) throw AppError.notFound("Không tìm thấy kỳ hóa đơn");
    if (period.status !== "draft") throw AppError.periodAlreadySent();
    const rows = await tx.query.meterReadings.findMany({ where: eq(meterReadings.billingPeriodId, periodId) });
    const seen = new Set<string>();
    const updates: MeterReadingResponse[] = [];
    for (const item of input.readings) {
      const key = `${item.roomId}:${item.type}`;
      if (seen.has(key)) throw AppError.badRequest("Không được gửi trùng chỉ số công tơ");
      seen.add(key);
      const row = rows.find((candidate) => candidate.roomId === item.roomId && candidate.type === item.type);
      if (!row) throw AppError.notFound("Không tìm thấy chỉ số công tơ");
      const current = parseMeterValue(item.currentReading);
      const previous = parseMeterValue(row.previousReading);
      if (current < previous) throw AppError.badRequest("Chỉ số mới không được nhỏ hơn chỉ số cũ");
      const expected = new Date(item.expectedUpdatedAt);
      if (Number.isNaN(expected.getTime())) throw AppError.badRequest("Thời điểm cập nhật không hợp lệ");
      if (row.updatedAt.getTime() !== expected.getTime()) {
        throw AppError.readingConflict({ id: row.id, roomId: row.roomId, type: row.type, previousReading: row.previousReading, currentReading: row.currentReading, readingDate: row.readingDate, updatedAt: row.updatedAt.toISOString() });
      }
      const [updated] = await tx.update(meterReadings).set({ currentReading: formatMeterValue(current), photoUrl: item.photoUrl ?? null, readingDate: new Date().toISOString().slice(0, 10), updatedAt: new Date() }).where(eq(meterReadings.id, row.id)).returning();
      if (!updated) {
        const latest = await tx.query.meterReadings.findFirst({ where: eq(meterReadings.id, row.id) });
        if (!latest) throw AppError.notFound("Không tìm thấy chỉ số công tơ");
        throw AppError.readingConflict({ id: latest.id, roomId: latest.roomId, type: latest.type, previousReading: latest.previousReading, currentReading: latest.currentReading, readingDate: latest.readingDate, updatedAt: latest.updatedAt.toISOString() });
      }
      updates.push({ id: updated.id, roomId: updated.roomId, type: updated.type, previousReading: updated.previousReading, currentReading: updated.currentReading, readingDate: updated.readingDate, updatedAt: updated.updatedAt.toISOString() });
    }
    return updates;
  });
}

async function invoiceResponse(row: typeof invoices.$inferSelect, roomName: string): Promise<InvoiceResponse> {
  return { ...row, roomName, paidAt: row.paidAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() };
}

export async function listInvoices(periodId: string, motelId: string, managerId: string): Promise<InvoiceResponse[]> {
  await resolveOwnedMotel(motelId, managerId);
  const period = await db.query.billingPeriods.findFirst({ where: and(eq(billingPeriods.id, periodId), eq(billingPeriods.motelId, motelId)) });
  if (!period) throw AppError.notFound("Không tìm thấy kỳ hóa đơn");
  const rows = await db.query.invoices.findMany({ where: and(eq(invoices.billingPeriodId, periodId), eq(invoices.motelId, motelId)), orderBy: [asc(invoices.id)] });
  const rooms = await listRoomsForBilling(motelId);
  return Promise.all(rows.map((invoice) => invoiceResponse(invoice, rooms.find((room) => room.id === invoice.roomId)?.name ?? "")));
}

export async function generateInvoices(periodId: string, motelId: string, managerId: string): Promise<InvoiceGenerationResponse> {
  const motel = await resolveOwnedMotel(motelId, managerId);
  return db.transaction(async (tx) => {
    const period = await tx.query.billingPeriods.findFirst({ where: and(eq(billingPeriods.id, periodId), eq(billingPeriods.motelId, motelId)) });
    if (!period) throw AppError.notFound("Không tìm thấy kỳ hóa đơn");
    if (period.status !== "draft") throw AppError.periodAlreadySent();
    const roomsForBilling = await listRoomsForBilling(motelId, tx);
    const contracts = await listBillableContractsForMotel(motelId, tx);
    const readings = await tx.query.meterReadings.findMany({ where: eq(meterReadings.billingPeriodId, periodId) });
    const skippedRooms = roomsForBilling.filter((room) => !contracts.some((contract) => contract.roomId === room.id));
    const output: InvoiceResponse[] = [];
    for (const contract of contracts) {
      const room = roomsForBilling.find((candidate) => candidate.id === contract.roomId);
      if (!room) continue;
      const electric = readings.find((reading) => reading.roomId === room.id && reading.type === "electric");
      const water = readings.find((reading) => reading.roomId === room.id && reading.type === "water");
      if (electric?.currentReading === null || electric?.currentReading === undefined || water?.currentReading === null || water?.currentReading === undefined) throw AppError.conflict(`Phòng ${room.name} chưa đủ chỉ số`);
      const amounts = calculateInvoiceAmounts({ electricity: { previous: electric.previousReading, current: electric.currentReading, unitPrice: motel.electricityPrice }, water: { previous: water.previousReading, current: water.currentReading, unitPrice: motel.waterPrice }, rentAmount: contract.monthlyRent, otherFees: motel.otherFees });
      const bank = motel.bankAccount;
      if (!bank) throw AppError.conflict("Nhà trọ chưa cấu hình tài khoản nhận tiền");
      const qrCodeData = buildVietQrPayload({ bankBin: bank.bankCode, accountNumber: bank.accountNumber, amount: amounts.totalAmount, description: buildTransferDescription({ motelName: motel.name, month: period.month, year: period.year, roomName: room.name }) });
      const [saved] = await tx.insert(invoices).values({ billingPeriodId: periodId, roomId: room.id, renterId: contract.renterId, motelId, rentAmount: amounts.rentAmount, electricityUsage: amounts.electricityUsage, electricityCost: amounts.electricityCost, waterUsage: amounts.waterUsage, waterCost: amounts.waterCost, otherFees: motel.otherFees, totalAmount: amounts.totalAmount, qrCodeData }).onConflictDoUpdate({ target: [invoices.billingPeriodId, invoices.roomId], set: { renterId: contract.renterId, rentAmount: amounts.rentAmount, electricityUsage: amounts.electricityUsage, electricityCost: amounts.electricityCost, waterUsage: amounts.waterUsage, waterCost: amounts.waterCost, otherFees: motel.otherFees, totalAmount: amounts.totalAmount, qrCodeData } }).returning();
      if (saved) output.push(await invoiceResponse(saved, room.name));
    }
    return { invoices: output, details: { skippedRooms } };
  });
}

export async function sendBillingPeriod(periodId: string, motelId: string, managerId: string): Promise<BillingPeriodResponse> {
  await resolveOwnedMotel(motelId, managerId);
  const result = await db.transaction(async (tx) => {
    const period = await tx.query.billingPeriods.findFirst({ where: and(eq(billingPeriods.id, periodId), eq(billingPeriods.motelId, motelId)) });
    if (!period) throw AppError.notFound("Không tìm thấy kỳ hóa đơn");
    if (period.status !== "draft") throw AppError.periodAlreadySent();
    const count = await tx.$count(invoices, eq(invoices.billingPeriodId, periodId));
    if (!count) throw AppError.conflict("Kỳ hóa đơn chưa có hóa đơn");
    const [updated] = await tx.update(billingPeriods).set({ status: "sent" }).where(and(eq(billingPeriods.id, periodId), eq(billingPeriods.status, "draft"))).returning();
    if (!updated) throw AppError.periodAlreadySent();
    const rows = await tx.query.invoices.findMany({ where: eq(invoices.billingPeriodId, periodId) });
    return { updated, rows };
  });
  for (const invoice of result.rows) {
    await enqueueNotification({ eventKey: `billing:${periodId}:sent:${invoice.renterId}`, renterId: invoice.renterId, motelId, templateId: "bill", payload: { invoiceId: invoice.id, totalAmount: invoice.totalAmount } }).catch(() => undefined);
  }
  return periodResponse(result.updated);

}

async function transitionInvoice(invoiceId: string, motelId: string, managerId: string, status: "paid" | "overdue"): Promise<InvoiceResponse> {
  await resolveOwnedMotel(motelId, managerId);
  const result = await db.transaction(async (tx) => {
    const row = await tx.query.invoices.findFirst({ where: and(eq(invoices.id, invoiceId), eq(invoices.motelId, motelId)) });
    if (!row) throw AppError.notFound("Không tìm thấy hóa đơn");
    const room = (await listRoomsForBilling(motelId, tx)).find((candidate) => candidate.id === row.roomId);
    if (!room) throw AppError.notFound("Không tìm thấy phòng");
    if (status === "overdue" && row.paymentStatus === "paid") throw AppError.conflict("Hóa đơn đã thanh toán");
     if (status === "paid" && row.paymentStatus === "paid") return { invoice: row, roomName: room.name };
     if (status === "overdue" && row.paymentStatus === "overdue") return { invoice: row, roomName: room.name };
      const [updated] = await tx.update(invoices).set({ paymentStatus: status, paidAt: status === "paid" ? new Date() : null }).where(eq(invoices.id, invoiceId)).returning();
       return { invoice: updated!, roomName: room.name };
    });
    if (status === "paid") await enqueueNotification({ eventKey: `invoice:${invoiceId}:paid`, renterId: result.invoice.renterId, motelId, templateId: "paymentConfirmed", payload: { invoiceId, totalAmount: result.invoice.totalAmount } }).catch(() => undefined);
    return invoiceResponse(result.invoice, result.roomName);
 }


export const markInvoicePaid = (invoiceId: string, motelId: string, managerId: string) => transitionInvoice(invoiceId, motelId, managerId, "paid");
export const markInvoiceOverdue = (invoiceId: string, motelId: string, managerId: string) => transitionInvoice(invoiceId, motelId, managerId, "overdue");

export async function settleInvoicePayment(invoiceId: string, motelId: string, managerId: string, method: "bank_transfer" | "cash", paymentProofId?: string) {
  await resolveOwnedMotel(motelId, managerId);
  return db.transaction(async (tx) => {
    const locked = await tx.execute(sql`select * from invoices where id = ${invoiceId} and motel_id = ${motelId} for update`);
    const row = locked[0] as typeof invoices.$inferSelect | undefined;
    if (!row) throw AppError.notFound("Không tìm thấy hóa đơn");
    if (row.paymentStatus === "paid") {
      if (row.paymentMethod !== method || (method === "bank_transfer" && row.paymentProofId !== paymentProofId)) throw AppError.conflict("Hóa đơn đã thanh toán bằng phương thức khác");
      return row;
    }
    const [updated] = await tx.update(invoices).set({ paymentStatus: "paid", paymentMethod: method, paymentProofId: paymentProofId ?? null, paidAt: new Date() }).where(eq(invoices.id, invoiceId)).returning();
    if (!updated) throw AppError.externalService();
    return updated;
  });
}

export async function uploadMeterPhoto(motelId: string, periodId: string, readingId: string, managerId: string, file: File): Promise<UploadResponse> {
  await resolveOwnedMotel(motelId, managerId);
  const reading = await db.query.meterReadings.findFirst({ where: and(eq(meterReadings.id, readingId), eq(meterReadings.billingPeriodId, periodId)) });
  const period = await db.query.billingPeriods.findFirst({ where: and(eq(billingPeriods.id, periodId), eq(billingPeriods.motelId, motelId)) });
  if (!reading || !period) throw AppError.notFound("Không tìm thấy chỉ số công tơ");
  if (period.status !== "draft") throw AppError.periodAlreadySent();
  if (file.type !== "image/jpeg" && file.type !== "image/png") throw AppError.badRequest("Chỉ hỗ trợ ảnh JPEG hoặc PNG");
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    await validateStorageInput({ objectKey: "validation/key", body: bytes, contentType: file.type });
  } catch (error) {
    if (error instanceof StorageError) throw AppError.badRequest(error.message);
    throw error;
  }
  const objectKey = `motels/${motelId}/meter/${readingId}/${crypto.randomUUID()}`;
  try {
    const stored = await uploadStorage.put({ objectKey, body: bytes, contentType: file.type });
    let previousKey: string | undefined;
    try {
      const row = await db.transaction(async (tx) => {
        const previous = await tx.query.uploads.findFirst({ where: and(eq(uploads.resourceType, "meter_reading"), eq(uploads.resourceId, readingId)) });
        previousKey = previous?.objectKey;
        if (previous) await tx.delete(uploads).where(eq(uploads.id, previous.id));
        const [created] = await tx.insert(uploads).values({ resourceType: "meter_reading", resourceId: readingId, motelId, objectKey: stored.objectKey, contentType: stored.contentType, size: stored.size, checksum: stored.checksum }).returning();
        if (!created) throw AppError.externalService();
        const linked = await tx.update(meterReadings).set({ photoUrl: stored.objectKey }).where(eq(meterReadings.id, readingId)).returning({ id: meterReadings.id });
        if (linked.length === 0) throw AppError.notFound("Không tìm thấy chỉ số công tơ");
        return created;
      });
      if (previousKey) await uploadStorage.delete(previousKey).catch(() => undefined);
      return { id: row.id, contentType: row.contentType, size: row.size, checksum: row.checksum, createdAt: row.createdAt.toISOString() };
    } catch (error) {
      await uploadStorage.delete(stored.objectKey).catch(() => undefined);
      if (error instanceof AppError) throw error;
      throw AppError.externalService();
    }
  } catch (error) {
    if (error instanceof AppError || error instanceof StorageError) throw error instanceof StorageError ? AppError.externalService() : error;
    throw AppError.externalService();
  }
}

export async function getMeterPhoto(motelId: string, periodId: string, readingId: string, managerId: string): Promise<SignedUploadResponse> {
  await resolveOwnedMotel(motelId, managerId);
  const reading = await db.query.meterReadings.findFirst({ where: and(eq(meterReadings.id, readingId), eq(meterReadings.billingPeriodId, periodId)) });
  const upload = await db.query.uploads.findFirst({ where: and(eq(uploads.resourceType, "meter_reading"), eq(uploads.resourceId, readingId), eq(uploads.motelId, motelId)) });
  if (!reading || !upload) throw AppError.notFound("Không tìm thấy ảnh công tơ");
  try { return { url: await uploadStorage.createSignedDownload(upload.objectKey, 300), contentType: upload.contentType, size: upload.size, checksum: upload.checksum }; } catch { throw AppError.externalService(); }
}

export async function countBillingPeriodsForMotel(motelId: string): Promise<number> {
  return db.$count(billingPeriods, eq(billingPeriods.motelId, motelId));
}

export interface RecentInvoice {
  id: string;
  billingPeriodId: string;
  totalAmount: VndString;
  paymentStatus: "unpaid" | "paid" | "overdue";
  /** ISO-8601 UTC string on the wire. */
  createdAt: string;
}

/**
 * A renter's invoices, newest first, capped at `limit`.
 *
 * `limit` is the caller's decision, not this module's: how much history belongs on a screen is a
 * property of that screen. An empty list is a normal answer — a renter who has not been billed
 * yet is not an error.
 *
 * The ordering falls back to `id` so two invoices written in the same microsecond still come back
 * in a fixed order; a caller paginating this would otherwise see the same row twice.
 */
export async function listRecentInvoicesForRenter(
  renterId: string,
  limit: number,
): Promise<RecentInvoice[]> {
  const rows = await db.query.invoices.findMany({
    where: eq(invoices.renterId, renterId),
    orderBy: [desc(invoices.createdAt), desc(invoices.id)],
    limit,
  });

  // `createdAt` is a `timestamptz` and the contract asks for ISO-8601 UTC on the wire. Spelling
  // that out here is what lets `RecentInvoice.createdAt` be a `string`: `numeric` handing back a
  // JS number for `totalAmount` would fail this return type instead of slipping through.
  return rows.map((row) => ({
    id: row.id,
    billingPeriodId: row.billingPeriodId,
    totalAmount: row.totalAmount,
    paymentStatus: row.paymentStatus,
    createdAt: row.createdAt.toISOString(),
  }));
}