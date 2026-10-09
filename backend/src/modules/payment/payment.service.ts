import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices, billingPeriods } from "@/modules/billing/billing.schema";
import { settleInvoicePayment } from "@/modules/billing/billing.service";
import { enforceRateLimit } from "@/shared/rate-limit";
import { enqueueNotification } from "@/modules/notification/notification.service";
import { paymentProofs } from "./payment.schema";
import { AppError } from "@/shared/errors";
import { FakeStorageAdapter, StorageError, type StorageAdapter, validateStorageInput } from "@/shared/storage";
import type { PaymentProofResponse } from "./payment.types";
import type { RenterAuthPayload } from "@/middleware/renter-auth";

let paymentStorage: StorageAdapter = new FakeStorageAdapter();
export function configurePaymentStorage(storage: StorageAdapter): void { paymentStorage = storage; }

function response(row: typeof paymentProofs.$inferSelect): PaymentProofResponse {
  return { id: row.id, invoiceId: row.invoiceId, status: row.status, contentType: row.contentType as "image/jpeg" | "image/png", size: row.size, submittedAt: row.submittedAt.toISOString(), reviewedAt: row.reviewedAt?.toISOString() ?? null, rejectionReason: row.rejectionReason };
}

async function invoiceForRenter(session: RenterAuthPayload, invoiceId: string) {
  const row = await db.select({ invoice: invoices, period: billingPeriods }).from(invoices).innerJoin(billingPeriods, eq(billingPeriods.id, invoices.billingPeriodId)).where(and(eq(invoices.id, invoiceId), eq(invoices.renterId, session.renterId), eq(invoices.motelId, session.motelId))).limit(1);
  return row[0];
}

export async function submitPaymentProof(session: RenterAuthPayload, invoiceId: string, file: File): Promise<PaymentProofResponse> {
  enforceRateLimit(`upload:${session.renterId}`, 10);
  if (file.size > 10 * 1024 * 1024) throw AppError.badRequest("Tệp vượt quá giới hạn 10 MB");
  const owned = await invoiceForRenter(session, invoiceId);
  if (!owned) throw AppError.notFound("Không tìm thấy hóa đơn");
  if (owned.invoice.paymentStatus === "paid") throw AppError.conflict("Hóa đơn đã thanh toán");
  if (owned.period.status === "draft") throw AppError.conflict("Kỳ hóa đơn chưa gửi");
  const current = await db.query.paymentProofs.findFirst({ where: and(eq(paymentProofs.invoiceId, invoiceId), eq(paymentProofs.motelId, session.motelId), eq(paymentProofs.renterId, session.renterId), eq(paymentProofs.status, "pending")) });
  if (current) throw AppError.conflict("Hóa đơn đã có chứng từ đang chờ duyệt");
  const approved = await db.query.paymentProofs.findFirst({ where: and(eq(paymentProofs.invoiceId, invoiceId), eq(paymentProofs.status, "approved")) });
  if (approved) throw AppError.conflict("Hóa đơn đã có chứng từ được duyệt");
  const contentType = file.type as "image/jpeg" | "image/png";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const objectKey = `motels/${session.motelId}/renters/${session.renterId}/payment-proofs/${crypto.randomUUID()}`;
  let stored: Awaited<ReturnType<StorageAdapter["put"]>>;
  try { await validateStorageInput({ objectKey, body: bytes, contentType }); stored = await paymentStorage.put({ objectKey, body: bytes, contentType }); } catch (error) { if (error instanceof StorageError) throw AppError.badRequest(error.message); throw AppError.externalService(); }
  try {
    const row = await db.transaction(async (tx) => {
      const locked = await tx.execute(sql`select id from invoices where id = ${invoiceId} and motel_id = ${session.motelId} and payment_status <> 'paid' for update`);
      if (!locked.length) throw AppError.conflict("Hóa đơn đã thanh toán");
      const [created] = await tx.insert(paymentProofs).values({ invoiceId, renterId: session.renterId, motelId: session.motelId, objectKey: stored.objectKey, contentType: stored.contentType, size: stored.size, checksum: stored.checksum }).returning();
      if (!created) throw AppError.externalService();
      await enqueueNotification({ eventKey: `invoice:${invoiceId}:proof:${created.id}:submitted`, renterId: created.renterId, motelId: created.motelId, templateId: "paymentProofSubmitted", payload: { invoiceId } }, tx);
      return created;
    });
    return response(row);
  } catch (error) { await paymentStorage.delete(stored.objectKey).catch(() => undefined); if ((error as { code?: string }).code === "23505") throw AppError.conflict("Hóa đơn đã có chứng từ"); throw error; }
}

export async function getRenterPaymentProof(session: RenterAuthPayload, invoiceId: string): Promise<PaymentProofResponse & { signedUrl: string } | null> {
  if (!(await invoiceForRenter(session, invoiceId))) throw AppError.notFound("Không tìm thấy hóa đơn");
  const row = await db.query.paymentProofs.findFirst({ where: and(eq(paymentProofs.invoiceId, invoiceId), eq(paymentProofs.renterId, session.renterId), eq(paymentProofs.motelId, session.motelId)), orderBy: (p, { desc }) => [desc(p.submittedAt)] });
  if (!row) return null;
  if (!ownedKey(row.objectKey, session.motelId, session.renterId)) throw AppError.notFound("Không tìm thấy chứng từ");
  try { return { ...response(row), signedUrl: await paymentStorage.createSignedDownload(row.objectKey, 300) }; } catch { throw AppError.externalService(); }
}

function ownedKey(objectKey: string, motelId: string, renterId: string): boolean { return objectKey.startsWith(`motels/${motelId}/renters/${renterId}/payment-proofs/`); }

async function managerInvoice(managerId: string, motelId: string, invoiceId: string) {
  const row = await db.query.invoices.findFirst({ where: and(eq(invoices.id, invoiceId), eq(invoices.motelId, motelId)) });
  if (!row) throw AppError.notFound("Không tìm thấy hóa đơn");
  const motel = await db.query.motels.findFirst({ where: (m, { and, eq }) => and(eq(m.id, motelId), eq(m.managerId, managerId)) });
  if (!motel) throw AppError.notFound("Không tìm thấy hóa đơn");
  return row;
}

export async function getManagerPaymentProof(managerId: string, motelId: string, invoiceId: string) {
  await managerInvoice(managerId, motelId, invoiceId);
  const row = await db.query.paymentProofs.findFirst({ where: and(eq(paymentProofs.invoiceId, invoiceId), eq(paymentProofs.motelId, motelId)), orderBy: (p, { desc }) => [desc(p.submittedAt)] });
  if (!row) throw AppError.notFound("Không tìm thấy chứng từ");
  if (!ownedKey(row.objectKey, motelId, row.renterId)) throw AppError.notFound("Không tìm thấy chứng từ");
  try { return { ...response(row), renterId: row.renterId, reviewedByManagerId: row.reviewedByManagerId, signedUrl: await paymentStorage.createSignedDownload(row.objectKey, 300) }; } catch { throw AppError.externalService(); }
}

export async function approvePaymentProof(managerId: string, motelId: string, invoiceId: string) {
  enforceRateLimit(`review:${managerId}`, 30);
  await managerInvoice(managerId, motelId, invoiceId);
  const result = await db.transaction(async (tx) => {
    const lockedInvoice = await tx.execute(sql`select * from invoices where id = ${invoiceId} and motel_id = ${motelId} for update`);
    if (!lockedInvoice.length) throw AppError.notFound("Không tìm thấy hóa đơn");
    const lockedProofs = await tx.execute(sql`select * from payment_proofs where invoice_id = ${invoiceId} and motel_id = ${motelId} and status in ('pending', 'approved') order by id for update`);
    const proof = lockedProofs[0] as typeof paymentProofs.$inferSelect | undefined;
    if (!proof) throw AppError.conflict("Không có chứng từ chờ duyệt");
    const updated = proof.status === "approved" ? proof : (await tx.update(paymentProofs).set({ status: "approved", reviewedAt: new Date(), reviewedByManagerId: managerId }).where(and(eq(paymentProofs.id, proof.id), eq(paymentProofs.motelId, motelId), eq(paymentProofs.status, "pending"))).returning())[0];
    if (!updated) throw AppError.conflict("Chứng từ đã được xử lý");
    const invoice = lockedInvoice[0] as typeof invoices.$inferSelect | undefined;
    if (!invoice) throw AppError.notFound("Không tìm thấy hóa đơn");
    if (invoice.paymentStatus === "paid" && (invoice.paymentMethod !== "bank_transfer" || invoice.paymentProofId !== updated.id)) throw AppError.conflict("Hóa đơn đã thanh toán bằng phương thức khác");
    const settled = invoice.paymentStatus === "paid" ? invoice : (await tx.update(invoices).set({ paymentStatus: "paid", paymentMethod: "bank_transfer", paymentProofId: updated.id, paidAt: new Date() }).where(and(eq(invoices.id, invoiceId), eq(invoices.motelId, motelId))).returning())[0];
    if (!settled) throw AppError.externalService();
    await enqueueNotification({ eventKey: `invoice:${invoiceId}:paid`, renterId: settled.renterId, motelId, templateId: "paymentConfirmed", payload: { invoiceId, totalAmount: settled.totalAmount } }, tx);
    return settled;
  });
  return { invoiceId, paymentStatus: result.paymentStatus, paidAt: result.paidAt, paymentMethod: "bank_transfer" as const };
}

export async function rejectPaymentProof(managerId: string, motelId: string, invoiceId: string, reason: string) {
  enforceRateLimit(`review:${managerId}`, 30);
  await managerInvoice(managerId, motelId, invoiceId);
  const clean = reason.trim(); if (!clean || clean.length > 500) throw AppError.badRequest("Lý do từ chối phải dài từ 1 đến 500 ký tự");
  const proof = await db.query.paymentProofs.findFirst({ where: and(eq(paymentProofs.invoiceId, invoiceId), eq(paymentProofs.motelId, motelId), eq(paymentProofs.status, "pending")) });
  if (!proof) throw AppError.conflict("Không có chứng từ chờ duyệt");
  const updated = await db.transaction(async (tx) => {
    const locked = await tx.execute(sql`select * from payment_proofs where id = ${proof.id} and invoice_id = ${invoiceId} and motel_id = ${motelId} for update`);
    if (!locked.length) throw AppError.conflict("Chứng từ đã được xử lý");
    const [row] = await tx.update(paymentProofs).set({ status: "rejected", reviewedAt: new Date(), reviewedByManagerId: managerId, rejectionReason: clean }).where(and(eq(paymentProofs.id, proof.id), eq(paymentProofs.status, "pending"))).returning();
    if (!row) throw AppError.conflict("Chứng từ đã được xử lý");
    await enqueueNotification({ eventKey: `invoice:${invoiceId}:proof-rejected`, renterId: row.renterId, motelId, templateId: "paymentProofRejected", payload: { invoiceId, reason: clean } }, tx);
    return row;
  });
  return response(updated);
}

export async function confirmCashPayment(managerId: string, motelId: string, invoiceId: string) {
  enforceRateLimit(`review:${managerId}`, 30);
  await managerInvoice(managerId, motelId, invoiceId);
  const result = await db.transaction(async (tx) => {
    const locked = await tx.execute(sql`select * from invoices where id = ${invoiceId} and motel_id = ${motelId} for update`);
    const invoice = locked[0] as typeof invoices.$inferSelect | undefined;
    if (!invoice) throw AppError.notFound("Không tìm thấy hóa đơn");
    if (invoice.paymentStatus === "paid" && invoice.paymentMethod !== "cash") throw AppError.conflict("Hóa đơn đã thanh toán bằng phương thức khác");
    const settled = invoice.paymentStatus === "paid" ? invoice : (await tx.update(invoices).set({ paymentStatus: "paid", paymentMethod: "cash", paymentProofId: null, paidAt: new Date() }).where(eq(invoices.id, invoiceId)).returning())[0];
    if (!settled) throw AppError.externalService();
    await enqueueNotification({ eventKey: `invoice:${invoiceId}:paid`, renterId: settled.renterId, motelId, templateId: "paymentConfirmed", payload: { invoiceId, totalAmount: settled.totalAmount } }, tx);
    return settled;
  });
  return { invoiceId, paymentStatus: result.paymentStatus, paidAt: result.paidAt, paymentMethod: "cash" as const };
}
