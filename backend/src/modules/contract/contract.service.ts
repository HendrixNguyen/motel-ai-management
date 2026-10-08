import { and, asc, desc, eq, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import {
  resolveOwnedMotel,
  resolveRoomInMotel,
  resolveRenterInMotel,
} from "@/middleware/tenancy";
import { getRoomName } from "@/modules/room/room.service";
import { parseAmount, type VndString } from "@/shared/money";
import { AppError } from "@/shared/errors";
import { contracts, contractTemplates } from "./contract.schema";
import { enqueueNotification } from "@/modules/notification/notification.service";
import type {
  ContractResponse,
  ContractTemplateInput,
  ContractTemplateResponse,
  CreateContractInput,
  UpdateContractInput,
  UpdateContractTemplateInput,
} from "./contract.types";

function templateResponse(
  row: typeof contractTemplates.$inferSelect,
): ContractTemplateResponse {
  return { ...row, createdAt: row.createdAt.toISOString() };
}
function contractResponse(
  row: typeof contracts.$inferSelect,
): ContractResponse {
  return {
    id: row.id,
    motelId: row.motelId,
    renterId: row.renterId,
    roomId: row.roomId,
    templateId: row.templateId,
    startDate: row.startDate,
    endDate: row.endDate,
    monthlyRent: row.monthlyRent as VndString,
    deposit: row.deposit as VndString,
    clauses: row.clauses,
    otpSentAt: row.otpSentAt?.toISOString() ?? null,
    otpSignedAt: row.otpSignedAt?.toISOString() ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validateContractDates(startDate: string, endDate: string) {
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate) || endDate <= startDate)
    throw AppError.badRequest("Ngày kết thúc phải sau ngày bắt đầu");
}

function validateTemplate(
  input: ContractTemplateInput | UpdateContractTemplateInput,
) {
  if (input.name !== undefined && !input.name.trim())
    throw AppError.badRequest("Tên mẫu hợp đồng không được để trống");
  if (
    input.clauses !== undefined &&
    input.clauses.some((c) => !c.title.trim() || !c.content.trim())
  )
    throw AppError.badRequest("Điều khoản không được để trống");
}
async function clearDefault(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  motelId: string,
) {
  await tx
    .update(contractTemplates)
    .set({ isDefault: false })
    .where(
      and(
        eq(contractTemplates.motelId, motelId),
        eq(contractTemplates.isDefault, true),
      ),
    );
}
export async function listContractTemplates(
  motelId: string,
  managerId: string,
) {
  await resolveOwnedMotel(motelId, managerId);
  return (
    await db
      .select()
      .from(contractTemplates)
      .where(eq(contractTemplates.motelId, motelId))
      .orderBy(asc(contractTemplates.createdAt), asc(contractTemplates.id))
  ).map(templateResponse);
}
export async function createContractTemplate(
  motelId: string,
  managerId: string,
  input: ContractTemplateInput,
) {
  await resolveOwnedMotel(motelId, managerId);
  validateTemplate(input);
  const result = await db.transaction(async (tx) => {
    if (input.isDefault) await clearDefault(tx, motelId);
    return tx
      .insert(contractTemplates)
      .values({
        motelId,
        name: input.name.trim(),
        clauses: input.clauses,
        isDefault: input.isDefault ?? false,
      })
      .returning();
  });
  return templateResponse(result[0]!);
}
export async function getContractTemplate(
  motelId: string,
  templateId: string,
  managerId: string,
) {
  await resolveOwnedMotel(motelId, managerId);
  const row = await db.query.contractTemplates.findFirst({
    where: and(
      eq(contractTemplates.id, templateId),
      eq(contractTemplates.motelId, motelId),
    ),
  });
  if (!row) throw AppError.notFound("Không tìm thấy mẫu hợp đồng");
  return templateResponse(row);
}
export async function updateContractTemplate(
  motelId: string,
  templateId: string,
  managerId: string,
  input: UpdateContractTemplateInput,
) {
  const current = await getContractTemplate(motelId, templateId, managerId);
  validateTemplate(input);
  const patch: Partial<typeof contractTemplates.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.clauses !== undefined) patch.clauses = input.clauses;
  if (input.isDefault !== undefined) patch.isDefault = input.isDefault;
  if (!Object.keys(patch).length) return current;
  const result = await db.transaction(async (tx) => {
    if (input.isDefault) await clearDefault(tx, motelId);
    return tx
      .update(contractTemplates)
      .set(patch)
      .where(eq(contractTemplates.id, templateId))
      .returning();
  });
  return templateResponse(result[0]!);
}
export async function deleteContractTemplate(
  motelId: string,
  templateId: string,
  managerId: string,
) {
  await getContractTemplate(motelId, templateId, managerId);
  if (await db.$count(contracts, eq(contracts.templateId, templateId)))
    throw AppError.conflict("Không thể xóa mẫu hợp đồng đang được sử dụng");
  await db
    .delete(contractTemplates)
    .where(eq(contractTemplates.id, templateId));
}

async function ownedContract(
  motelId: string,
  contractId: string,
  managerId: string,
) {
  await resolveOwnedMotel(motelId, managerId);
  const row = await db.query.contracts.findFirst({
    where: and(eq(contracts.id, contractId), eq(contracts.motelId, motelId)),
  });
  if (!row) throw AppError.notFound("Không tìm thấy hợp đồng");
  return row;
}
export async function createContract(
  motelId: string,
  managerId: string,
  input: CreateContractInput,
) {
  await resolveOwnedMotel(motelId, managerId);
  validateContractDates(input.startDate, input.endDate);
  const room = await resolveRoomInMotel(input.roomId, motelId);
  if (await hasActiveContractForRoom(room.id))
    throw AppError.conflict("Phòng đã có hợp đồng đang hoạt động");
  await resolveRenterInMotel(input.renterId, motelId);
  const template = input.templateId
    ? await db.query.contractTemplates.findFirst({
        where: and(
          eq(contractTemplates.id, input.templateId),
          eq(contractTemplates.motelId, motelId),
        ),
      })
    : await db.query.contractTemplates.findFirst({
        where: and(
          eq(contractTemplates.motelId, motelId),
          eq(contractTemplates.isDefault, true),
        ),
      });
  if (input.templateId && !template)
    throw AppError.notFound("Không tìm thấy mẫu hợp đồng");
  const [row] = await db
    .insert(contracts)
    .values({
      motelId,
      renterId: input.renterId,
      roomId: room.id,
      templateId: template?.id,
      startDate: input.startDate,
      endDate: input.endDate,
      monthlyRent: input.monthlyRent ? parseAmount(input.monthlyRent) : room.basePrice,
      deposit: input.deposit ? parseAmount(input.deposit) : "0",
      clauses: input.clauses ?? template?.clauses ?? [],
    })
    .returning();
  return contractResponse(row!);
}
export async function listContracts(
  motelId: string,
  managerId: string,
  status?: "draft" | "active" | "expired" | "terminated",
) {
  await resolveOwnedMotel(motelId, managerId);
  const where = status
    ? and(eq(contracts.motelId, motelId), eq(contracts.status, status))
    : eq(contracts.motelId, motelId);
  return (
    await db
      .select()
      .from(contracts)
      .where(where)
      .orderBy(desc(contracts.createdAt), desc(contracts.id))
  ).map(contractResponse);
}
export async function getContract(
  motelId: string,
  contractId: string,
  managerId: string,
) {
  return contractResponse(await ownedContract(motelId, contractId, managerId));
}
export async function updateContract(
  motelId: string,
  contractId: string,
  managerId: string,
  input: UpdateContractInput,
) {
  const current = await ownedContract(motelId, contractId, managerId);
  if (current.status !== "draft")
    throw AppError.conflict("Chỉ có thể chỉnh sửa hợp đồng nháp");
  if (input.startDate || input.endDate) validateContractDates(input.startDate ?? current.startDate, input.endDate ?? current.endDate);
  if (input.monthlyRent !== undefined) input = { ...input, monthlyRent: parseAmount(input.monthlyRent) };
  if (input.deposit !== undefined) input = { ...input, deposit: parseAmount(input.deposit) };
  if (input.templateId) {
    const template = await db.query.contractTemplates.findFirst({
      where: and(
        eq(contractTemplates.id, input.templateId),
        eq(contractTemplates.motelId, motelId),
      ),
    });
    if (!template) throw AppError.notFound("Không tìm thấy mẫu hợp đồng");
    input = { ...input, clauses: template.clauses };
  }
  const [row] = await db
    .update(contracts)
    .set(input)
    .where(and(eq(contracts.id, contractId), eq(contracts.motelId, motelId)))
    .returning();
  return contractResponse(row!);
}
export async function terminateContract(
  motelId: string,
  contractId: string,
  managerId: string,
) {
  const current = await ownedContract(motelId, contractId, managerId);
  if (current.status !== "active")
    throw AppError.conflict("Chỉ có thể chấm dứt hợp đồng đang hoạt động");
  const [row] = await db
    .update(contracts)
    .set({ status: "terminated" })
    .where(and(eq(contracts.id, contractId), eq(contracts.motelId, motelId)))
    .returning();
  return contractResponse(row!);
}
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 3;

type OtpGenerator = () => string | Promise<string>;

function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function renterContract(contractId: string, renterId: string, motelId: string) {
  const row = await db.query.contracts.findFirst({ where: and(eq(contracts.id, contractId), eq(contracts.renterId, renterId), eq(contracts.motelId, motelId)) });
  if (!row) throw AppError.notFound("Không tìm thấy hợp đồng");
  return row;
}

export async function getRenterContract(contractId: string, renterId: string, motelId: string) {
  return contractResponse(await renterContract(contractId, renterId, motelId));
}

export async function getLatestRenterContract(renterId: string, motelId: string) {
  const [row] = await db.select().from(contracts).where(and(eq(contracts.renterId, renterId), eq(contracts.motelId, motelId))).orderBy(desc(contracts.createdAt), desc(contracts.id)).limit(1);
  if (!row) throw AppError.notFound("Không tìm thấy hợp đồng");
  return contractResponse(row);
}

export async function requestContractOtp(contractId: string, renterId: string, motelId: string, generator: OtpGenerator = generateOtp) {
  const otp = await generator();
  const now = new Date();
  const hash = await Bun.password.hash(otp, { algorithm: "argon2id" });
  const expires = new Date(now.getTime() + OTP_TTL_MS);
  const staged = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM contracts WHERE id = ${contractId} AND renter_id = ${renterId} AND motel_id = ${motelId} FOR UPDATE`);
    const current = await tx.query.contracts.findFirst({ where: and(eq(contracts.id, contractId), eq(contracts.renterId, renterId), eq(contracts.motelId, motelId)) });
    if (!current) throw AppError.notFound("Không tìm thấy hợp đồng");
    if (current.status !== "draft") throw AppError.conflict("Hợp đồng không ở trạng thái chờ ký");
    if (current.otpSentAt && Date.now() - current.otpSentAt.getTime() < OTP_COOLDOWN_MS) throw AppError.rateLimited("Vui lòng thử lại sau", Math.ceil((OTP_COOLDOWN_MS - (Date.now() - current.otpSentAt.getTime())) / 1000));
    const [row] = await tx.update(contracts).set({ otpHash: hash, otpSentAt: now, otpExpiresAt: expires, otpAttempts: "0" }).where(and(eq(contracts.id, contractId), eq(contracts.status, "draft"))).returning();
    if (!row) throw AppError.conflict("Hợp đồng không ở trạng thái chờ ký");
    return { row, previous: current };
  });
   try {
     await enqueueNotification({ eventKey: `contract:${contractId}:otp:${now.toISOString()}`, renterId, motelId, templateId: "otp", payload: { contractId, expiresAt: expires.toISOString(), otp: "[REDACTED]" }, transientSecret: { otp } });
   } catch {
     await db.update(contracts).set({ otpHash: staged.previous.otpHash, otpSentAt: staged.previous.otpSentAt, otpExpiresAt: staged.previous.otpExpiresAt, otpAttempts: staged.previous.otpAttempts }).where(and(eq(contracts.id, contractId), eq(contracts.otpHash, hash), eq(contracts.otpSentAt, now), eq(contracts.otpExpiresAt, expires)));
     throw new AppError("EXTERNAL_SERVICE_ERROR", "Không thể gửi mã xác thực");
   }

   return { sentAt: now.toISOString() };
}


export async function verifyContractOtp(contractId: string, renterId: string, motelId: string, otp: string) {
  const current = await db.query.contracts.findFirst({ where: and(eq(contracts.id, contractId), eq(contracts.renterId, renterId), eq(contracts.motelId, motelId)) });
  if (!current) throw AppError.notFound("Không tìm thấy hợp đồng");
  if (current.status !== "draft") throw AppError.conflict("Hợp đồng không ở trạng thái chờ ký");
  if (!current.otpExpiresAt || current.otpExpiresAt <= new Date()) throw new AppError("OTP_EXPIRED", "Mã xác thực đã hết hạn");
  const [claimed] = await db.update(contracts).set({ otpAttempts: sql`${contracts.otpAttempts} + 1` }).where(and(eq(contracts.id, contractId), eq(contracts.status, "draft"), sql`${contracts.otpAttempts} < ${MAX_OTP_ATTEMPTS}`, sql`${contracts.otpExpiresAt} > now()`)).returning();
  if (!claimed || !current.otpHash || !(await Bun.password.verify(otp, current.otpHash))) throw new AppError("OTP_INVALID", "Mã xác thực không hợp lệ");
  return db.transaction(async (tx) => {
    const [row] = await tx.update(contracts).set({ status: "active", otpSignedAt: new Date(), otpHash: null, otpExpiresAt: null }).where(and(eq(contracts.id, contractId), eq(contracts.status, "draft"))).returning();
    if (!row) throw AppError.conflict("Hợp đồng đã được ký");
    return contractResponse(row);
  });
}

export async function sendContract(
  motelId: string,
  contractId: string,
  managerId: string,
) {
  const current = await ownedContract(motelId, contractId, managerId);
  if (current.status !== "draft")
    throw AppError.conflict("Chỉ có thể gửi hợp đồng nháp");
  await enqueueNotification({ eventKey: `contract:${contractId}:sent`, renterId: current.renterId, motelId, templateId: "contract", payload: { contractId } });
  const [row] = await db
    .update(contracts)
    .set({ managerSentAt: new Date() })
    .where(eq(contracts.id, contractId))
    .returning();
  return contractResponse(row!);
}

export async function listBillableContractsForMotel(motelId: string): Promise<
  Array<{
    id: string;
    roomId: string;
    renterId: string;
    monthlyRent: VndString;
  }>
> {
  return db
    .select({
      id: contracts.id,
      roomId: contracts.roomId,
      renterId: contracts.renterId,
      monthlyRent: contracts.monthlyRent,
    })
    .from(contracts)
    .where(and(eq(contracts.motelId, motelId), eq(contracts.status, "active")))
    .orderBy(asc(contracts.roomId), asc(contracts.id));
}
export async function countContractTemplatesForMotel(
  motelId: string,
): Promise<number> {
  return db.$count(contractTemplates, eq(contractTemplates.motelId, motelId));
}
export async function hasActiveContractForRoom(
  roomId: string,
): Promise<boolean> {
  return (
    (await db.$count(
      contracts,
      and(eq(contracts.roomId, roomId), eq(contracts.status, "active")),
    )) > 0
  );
}
export interface ActiveContractSummary {
  id: string;
  roomId: string;
  roomName: string;
  startDate: string;
  endDate: string;
  monthlyRent: VndString;
}
export async function getActiveContractForRenter(
  renterId: string,
  motelId?: string,
): Promise<ActiveContractSummary | null> {
  const [row] = await db
    .select({
      id: contracts.id,
      roomId: contracts.roomId,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      monthlyRent: contracts.monthlyRent,
    })
    .from(contracts)
    .where(
      and(eq(contracts.renterId, renterId), ...(motelId ? [eq(contracts.motelId, motelId)] : []), eq(contracts.status, "active")),
    )
    .orderBy(desc(contracts.createdAt), desc(contracts.id))
    .limit(1);
  if (!row) return null;
  return { ...row, roomName: (await getRoomName(row.roomId)) ?? "" };
}
