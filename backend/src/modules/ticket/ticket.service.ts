import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ticketPhotoUploads } from "./ticket-upload.schema";
import { getRenterForNotification } from "@/modules/renter/renter.service";
import { enqueueNotification } from "@/modules/notification/notification.service";
import { helpTickets } from "./ticket.schema";
import { AppError } from "@/shared/errors";
import { FakeStorageAdapter, StorageError, type StorageAdapter, type StorageObject, validateStorageInput } from "@/shared/storage";
import type { TicketCategory, TicketResponse, CreateTicketInput } from "./ticket.types";

let ticketStorage: StorageAdapter = new FakeStorageAdapter();
export function configureTicketStorage(storage: StorageAdapter): void { ticketStorage = storage; }

function response(row: typeof helpTickets.$inferSelect, photos: string[]): TicketResponse {
  return { id: row.id, renterId: row.renterId, motelId: row.motelId, roomId: row.roomId, category: row.category, description: row.description, photoUrls: photos, status: row.status, createdAt: row.createdAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null };
}

async function withPhotos(row: typeof helpTickets.$inferSelect): Promise<TicketResponse> {
  const files = await db.query.ticketPhotoUploads.findMany({ where: and(eq(ticketPhotoUploads.ticketId, row.id), eq(ticketPhotoUploads.motelId, row.motelId)), orderBy: asc(ticketPhotoUploads.createdAt) });
  let urls: string[] = [];
  try { urls = await Promise.all(files.map((file) => ticketStorage.createSignedDownload(file.objectKey, 300))); } catch { urls = []; }
  return response(row, urls);
}

async function ownedTicket(ticketId: string, renterId: string, motelId: string) {
  const row = await db.query.helpTickets.findFirst({ where: and(eq(helpTickets.id, ticketId), eq(helpTickets.renterId, renterId), eq(helpTickets.motelId, motelId)) });
  if (!row) throw AppError.notFound("Không tìm thấy yêu cầu hỗ trợ");
  return row;
}

export async function createTicket(input: CreateTicketInput): Promise<TicketResponse> {
  const renter = await getRenterForNotification(input.renterId, input.motelId);
  if (!renter || renter.roomId !== input.roomId) throw AppError.notFound("Không tìm thấy người thuê");
  if (input.description.trim().length < 10) throw AppError.badRequest("Mô tả sự cố phải có ít nhất 10 ký tự");
  if (input.files.length > 5) throw AppError.badRequest("Tối đa 5 ảnh");
  const stored: StorageObject[] = [];
  let committed = false;
  try {
    for (const file of input.files) {
      if (file.type !== "image/jpeg" && file.type !== "image/png") throw AppError.badRequest("Chỉ hỗ trợ ảnh JPEG hoặc PNG");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const objectKey = `motels/${input.motelId}/tickets/${crypto.randomUUID()}`;
      try { await validateStorageInput({ objectKey, body: bytes, contentType: file.type }); } catch (error) { if (error instanceof StorageError) throw AppError.badRequest(error.message); throw error; }
      try { stored.push(await ticketStorage.put({ objectKey, body: bytes, contentType: file.type })); } catch { throw AppError.externalService(); }
    }
    const row = await db.transaction(async (tx) => {
      const [created] = await tx.insert(helpTickets).values({ renterId: input.renterId, motelId: input.motelId, roomId: input.roomId, category: input.category, description: input.description.trim(), photoUrls: stored.map((file) => file.objectKey) }).returning();
      if (!created) throw AppError.externalService();
      for (const file of stored) await tx.insert(ticketPhotoUploads).values({ ticketId: created.id, motelId: input.motelId, objectKey: file.objectKey, contentType: file.contentType, size: file.size, checksum: file.checksum });
      return created;
    });
    committed = true;
    try { await enqueueNotification({ eventKey: `ticket-created:${row.id}`, renterId: row.renterId, motelId: row.motelId, templateId: "ticket", payload: { category: row.category, description: row.description } }); } catch { /* notification failure must not roll back ticket */ }
    return await withPhotos(row);
  } catch (error) {
    if (!committed) await Promise.all(stored.map((file) => ticketStorage.delete(file.objectKey).catch(() => undefined)));
    if (committed) throw error;

    if (error instanceof AppError) throw error;
    throw AppError.externalService();
  }
}

export async function listTickets(renterId: string, motelId: string): Promise<TicketResponse[]> {
  const rows = await db.query.helpTickets.findMany({ where: and(eq(helpTickets.renterId, renterId), eq(helpTickets.motelId, motelId)), orderBy: asc(helpTickets.createdAt) });
  return Promise.all(rows.map(withPhotos));
}

export async function getTicket(ticketId: string, renterId: string, motelId: string): Promise<TicketResponse> {
  return withPhotos(await ownedTicket(ticketId, renterId, motelId));
}

export type { TicketCategory };
