import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { issueMagicLink } from "@/shared/magic-link";
import { renterLoginRequests } from "./renter-login-request.schema";
import { AppError } from "@/shared/errors";
import { normalisePhone } from "@/shared/phone";
import { enforceRateLimit } from "@/shared/rate-limit";
import { createHash } from "node:crypto";

export async function requestRenterLogin(code: string, rawPhone: string, ipKey: string): Promise<{ message: string }> {
  const phone = normalisePhone(rawPhone);
  await enforceRateLimit(`renter-login:ip:${ipKey}`, 5);
  const phoneHash = createHash("sha256").update(phone).digest("hex");
  await enforceRateLimit(`renter-login:phone:${phoneHash}`, 3);
  const motel = await db.query.motels.findFirst({ where: eq(motels.publicAccessCode, code), columns: { id: true } });
  if (motel) {
    const renter = await db.query.renters.findFirst({ where: and(eq(renters.motelId, motel.id), eq(renters.phone, phone), eq(renters.status, "active")), columns: { id: true } });
    if (renter) await db.insert(renterLoginRequests).values({ motelId: motel.id, renterId: renter.id }).onConflictDoNothing({ target: [renterLoginRequests.motelId, renterLoginRequests.renterId], where: sql`${renterLoginRequests.status} = 'pending'` });
  }
  return { message: "Nếu thông tin khớp hồ sơ đang hoạt động, chủ nhà sẽ nhận yêu cầu và gửi liên kết qua Zalo." };
}

export async function listLoginRequests(motelId: string, managerId: string) {
  const owned = await db.query.motels.findFirst({ where: and(eq(motels.id, motelId), eq(motels.managerId, managerId)), columns: { id: true } });
  if (!owned) throw AppError.notFound("Không tìm thấy nhà trọ");
  return db.select({ id: renterLoginRequests.id, renterId: renterLoginRequests.renterId, requestedAt: renterLoginRequests.requestedAt, renterName: renters.name, renterPhone: renters.phone, status: renterLoginRequests.status }).from(renterLoginRequests).innerJoin(renters, eq(renters.id, renterLoginRequests.renterId)).where(and(eq(renterLoginRequests.motelId, motelId), eq(renterLoginRequests.status, "pending"))).orderBy(asc(renterLoginRequests.requestedAt));
}

export async function issueLoginRequestLink(requestId: string, motelId: string, managerId: string) {
  const owned = await db.query.motels.findFirst({ where: and(eq(motels.id, motelId), eq(motels.managerId, managerId)), columns: { id: true } });
  if (!owned) throw AppError.notFound("Không tìm thấy yêu cầu");
  const request = await db.query.renterLoginRequests.findFirst({ where: and(eq(renterLoginRequests.id, requestId), eq(renterLoginRequests.motelId, motelId), eq(renterLoginRequests.status, "pending")) });
  if (!request) throw AppError.notFound("Không tìm thấy yêu cầu");
  return issueMagicLink(request.renterId);
}

export async function markLoginRequestHandled(requestId: string, motelId: string, managerId: string, status: "handled" | "dismissed") {
  const owned = await db.query.motels.findFirst({ where: and(eq(motels.id, motelId), eq(motels.managerId, managerId)), columns: { id: true } });
  if (!owned) throw AppError.notFound("Không tìm thấy yêu cầu");
  const [row] = await db.update(renterLoginRequests).set({ status, handledAt: new Date(), handledByManagerId: managerId }).where(and(eq(renterLoginRequests.id, requestId), eq(renterLoginRequests.motelId, motelId), eq(renterLoginRequests.status, "pending"))).returning({ id: renterLoginRequests.id });
  if (!row) throw AppError.notFound("Không tìm thấy yêu cầu");
  return { updated: true };
}
