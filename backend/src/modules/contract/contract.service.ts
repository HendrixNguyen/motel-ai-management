import { and, asc, desc, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, type Db, type DbExecutor, type DbTransaction } from "@/db";
import { resolveOwnedMotel, resolveRoomInMotel, resolveRenterInMotel } from "@/middleware/tenancy";
import { lockMotelForUpdate } from "@/modules/motel/motel.service";
import { getRoomName } from "@/modules/room/room.service";
import { getRenterForConsent } from "@/modules/renter/renter.service";
import { parseAmount, type VndString } from "@/shared/money";
import { AppError } from "@/shared/errors";
import { contracts, contractTemplates } from "./contract.schema";
import { enqueueNotification } from "@/modules/notification/notification.service";
import {
  computeTemplateFingerprint,
  previewCatalogTemplate,
} from "./contract-catalog.service";
import type {
  TemplatePreview,
  TemplateSelection,
} from "./contract-catalog.types";
import type {
  ContractResponse,
  ContractTemplateInput,
  ContractTemplateResponse,
  CreateContractInput,
  UpdateContractInput,
  UpdateContractTemplateInput,
} from "./contract.types";

function templateResponse(row: typeof contractTemplates.$inferSelect): ContractTemplateResponse {
  return { ...row, createdAt: row.createdAt.toISOString() };
}
function contractResponse(row: typeof contracts.$inferSelect): ContractResponse {
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
    termsVersion: createHash("sha256")
      .update(
        JSON.stringify({
          renterId: row.renterId,
          roomId: row.roomId,
          motelId: row.motelId,
          startDate: row.startDate,
          endDate: row.endDate,
          monthlyRent: row.monthlyRent,
          deposit: row.deposit,
          clauses: row.clauses,
        }),
      )
      .digest("hex"),
    consentAcceptedAt: row.consentAcceptedAt?.toISOString() ?? null,
    consentMethod: row.consentMethod as "session_consent" | null,
    consentEvidence: row.consentAcceptedAt
      ? {
          termsVersion: row.acceptedTermsVersion!,
          acceptedTermsSnapshot: row.acceptedTermsSnapshot,
        }
      : null,
    managerSentAt: row.managerSentAt?.toISOString() ?? null,
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

function validateTemplate(input: ContractTemplateInput | UpdateContractTemplateInput) {
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
  await lockMotelForUpdate(tx, motelId);
  await tx
    .update(contractTemplates)
    .set({ isDefault: false })
    .where(and(eq(contractTemplates.motelId, motelId), eq(contractTemplates.isDefault, true)));
}

export async function createContractTemplateInTransaction(
  tx: DbTransaction,
  motelId: string,
  managerId: string,
  input: ContractTemplateInput,
): Promise<ContractTemplateResponse> {
  await resolveOwnedMotel(motelId, managerId, tx);
  validateTemplate(input);
  if (input.isDefault) await clearDefault(tx, motelId);
  const [row] = await tx
    .insert(contractTemplates)
    .values({
      motelId,
      name: input.name.trim(),
      clauses: input.clauses,
      isDefault: input.isDefault ?? false,
    })
    .returning();
  return templateResponse(row!);
}

export async function previewOwnedTemplate(
  managerId: string,
  motelId: string,
  templateId: string,
  executor: DbExecutor = db,
): Promise<TemplatePreview> {
  await resolveOwnedMotel(motelId, managerId, executor);
  const [row] = await executor
    .select()
    .from(contractTemplates)
    .where(
      and(
        eq(contractTemplates.id, templateId),
        eq(contractTemplates.motelId, motelId),
      ),
    )
    .limit(1);

  if (!row) {
    throw AppError.notFound("Không tìm thấy mẫu hợp đồng");
  }

  const fingerprint = computeTemplateFingerprint(row.name, row.clauses);
  return {
    name: row.name,
    clauses: row.clauses,
    selection: {
      kind: "motel",
      motelId,
      templateId,
      fingerprint,
    },
  };
}

export async function copySetupTemplate(
  tx: DbTransaction,
  managerId: string,
  targetMotelId: string,
  selection: TemplateSelection,
  isDefault: boolean,
): Promise<ContractTemplateResponse> {
  await resolveOwnedMotel(targetMotelId, managerId, tx);

  let templateName: string;
  let templateClauses: typeof contractTemplates.$inferSelect.clauses;

  if (selection.kind === "catalog") {
    const catalogPreview = await previewCatalogTemplate(
      selection.key,
      selection.version,
      tx,
    );
    templateName = catalogPreview.name;
    templateClauses = catalogPreview.clauses;
  } else {
    await resolveOwnedMotel(selection.motelId, managerId, tx);
    const rows = await tx.execute(
      sql`SELECT id, motel_id, name, clauses, is_default, created_at FROM contract_templates WHERE id = ${selection.templateId} AND motel_id = ${selection.motelId} FOR UPDATE`,
    );
    const source = (rows as unknown as typeof contractTemplates.$inferSelect[])[0];
    if (!source) {
      throw AppError.notFound("Không tìm thấy mẫu hợp đồng nguồn");
    }

    const currentFingerprint = computeTemplateFingerprint(
      source.name,
      source.clauses,
    );
    if (currentFingerprint !== selection.fingerprint) {
      throw new AppError(
        "SETUP_SOURCE_CHANGED",
        "Mẫu hợp đồng nguồn đã thay đổi. Vui lòng xem trước lại.",
      );
    }

    templateName = source.name;
    templateClauses = source.clauses;
  }

  return createContractTemplateInTransaction(tx, targetMotelId, managerId, {
    name: templateName,
    clauses: templateClauses,
    isDefault,
  });
}

export async function copyContractTemplateFromCatalog(
  motelId: string,
  managerId: string,
  input: { catalogKey: string; catalogVersion: number; isDefault: boolean },
): Promise<ContractTemplateResponse> {
  return db.transaction(async (tx) => {
    return copySetupTemplate(
      tx,
      managerId,
      motelId,
      {
        kind: "catalog",
        key: input.catalogKey,
        version: input.catalogVersion,
      },
      input.isDefault,
    );
  });
}

export async function listContractTemplates(motelId: string, managerId: string) {
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
  return db.transaction(async (tx) => {
    return createContractTemplateInTransaction(tx, motelId, managerId, input);
  });
}
export async function getContractTemplate(motelId: string, templateId: string, managerId: string) {
  await resolveOwnedMotel(motelId, managerId);
  const row = await db.query.contractTemplates.findFirst({
    where: and(eq(contractTemplates.id, templateId), eq(contractTemplates.motelId, motelId)),
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
  await db.delete(contractTemplates).where(eq(contractTemplates.id, templateId));
}

async function ownedContract(motelId: string, contractId: string, managerId: string) {
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
        where: and(eq(contractTemplates.motelId, motelId), eq(contractTemplates.isDefault, true)),
      });
  if (input.templateId && !template) throw AppError.notFound("Không tìm thấy mẫu hợp đồng");
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
export async function getContract(motelId: string, contractId: string, managerId: string) {
  return contractResponse(await ownedContract(motelId, contractId, managerId));
}
export async function updateContract(
  motelId: string,
  contractId: string,
  managerId: string,
  input: UpdateContractInput,
) {
  const current = await ownedContract(motelId, contractId, managerId);
  if (current.status !== "draft") throw AppError.conflict("Chỉ có thể chỉnh sửa hợp đồng nháp");
  if (current.consentAcceptedAt)
    throw AppError.conflict("Hợp đồng đã được người thuê xác nhận; không thể sửa điều khoản");
  if (input.startDate || input.endDate)
    validateContractDates(input.startDate ?? current.startDate, input.endDate ?? current.endDate);
  if (input.monthlyRent !== undefined)
    input = { ...input, monthlyRent: parseAmount(input.monthlyRent) };
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
export async function terminateContract(motelId: string, contractId: string, managerId: string) {
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
async function renterContract(contractId: string, renterId: string, motelId: string) {
  const row = await db.query.contracts.findFirst({
    where: and(
      eq(contracts.id, contractId),
      eq(contracts.renterId, renterId),
      eq(contracts.motelId, motelId),
    ),
  });
  if (!row) throw AppError.notFound("Không tìm thấy hợp đồng");
  return row;
}

export async function getRenterContract(contractId: string, renterId: string, motelId: string) {
  return contractResponse(await renterContract(contractId, renterId, motelId));
}

export async function acceptRenterContractConsent(
  contractId: string,
  renterId: string,
  motelId: string,
  termsVersion: string,
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM contracts WHERE id = ${contractId} AND renter_id = ${renterId} AND motel_id = ${motelId} FOR UPDATE`,
    );
    const current = await tx.query.contracts.findFirst({
      where: and(
        eq(contracts.id, contractId),
        eq(contracts.renterId, renterId),
        eq(contracts.motelId, motelId),
      ),
    });
    if (!current) throw AppError.notFound("Không tìm thấy hợp đồng");
    const currentVersion = createHash("sha256")
      .update(
        JSON.stringify({
          renterId: current.renterId,
          roomId: current.roomId,
          motelId: current.motelId,
          startDate: current.startDate,
          endDate: current.endDate,
          monthlyRent: current.monthlyRent,
          deposit: current.deposit,
          clauses: current.clauses,
        }),
      )
      .digest("hex");
    if (
      current.consentAcceptedAt &&
      current.acceptedTermsVersion === termsVersion &&
      currentVersion === termsVersion
    )
      return contractResponse(current);
    if (current.status !== "draft") throw AppError.conflict("Hợp đồng không ở trạng thái chờ ký");
    if (currentVersion !== termsVersion)
      throw AppError.conflict("Điều khoản hợp đồng đã thay đổi. Tải lại để xem bản mới.");
    const renter = await getRenterForConsent(renterId, motelId);
    if (!renter || !renter.idNumber || !renter.cccdFrontUploaded || !renter.cccdBackUploaded)
      throw AppError.conflict("Chủ nhà cần hoàn tất thông tin CCCD trước khi ký.");
    const acceptedAt = new Date();
    const snapshot = {
      contractId: current.id,
      renterId: current.renterId,
      motelId: current.motelId,
      roomId: current.roomId,
      startDate: current.startDate,
      endDate: current.endDate,
      monthlyRent: current.monthlyRent,
      deposit: current.deposit,
      clauses: current.clauses,
    };
    const [updated] = await tx
      .update(contracts)
      .set({
        status: "active",
        consentAcceptedAt: acceptedAt,
        consentMethod: "session_consent",
        acceptedTermsVersion: currentVersion,
        acceptedTermsSnapshot: snapshot,
        otpHash: null,
        otpExpiresAt: null,
      })
      .where(and(eq(contracts.id, contractId), eq(contracts.status, "draft")))
      .returning();
    if (!updated) throw AppError.conflict("Hợp đồng đã được cập nhật");
    return contractResponse(updated);
  });
}

export async function getLatestRenterContract(renterId: string, motelId: string) {
  const [row] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.renterId, renterId), eq(contracts.motelId, motelId)))
    .orderBy(desc(contracts.createdAt), desc(contracts.id))
    .limit(1);
  if (!row) throw AppError.notFound("Không tìm thấy hợp đồng");
  return contractResponse(row);
}

export async function sendContract(motelId: string, contractId: string, managerId: string) {
  const current = await ownedContract(motelId, contractId, managerId);
  if (current.status !== "draft") throw AppError.conflict("Chỉ có thể gửi hợp đồng nháp");
  await enqueueNotification({
    eventKey: `contract:${contractId}:sent`,
    renterId: current.renterId,
    motelId,
    templateId: "contract",
    payload: { contractId },
  });
  const sentAt = new Date();
  const [row] = await db
    .update(contracts)
    .set({ managerSentAt: sentAt })
    .where(and(eq(contracts.id, contractId), eq(contracts.status, "draft")))
    .returning();
  if (!row) throw AppError.conflict("Hợp đồng đã thay đổi");
  return contractResponse(row);
}

export interface ExpiringContract {
  id: string;
  renterId: string;
  motelId: string;
  endDate: string;
  eventKey: string;
}
export async function listExpiringContracts(
  now: Date,
  until: Date,
  windowDays: number,
): Promise<ExpiringContract[]> {
  const rows = await db.query.contracts.findMany({
    where: and(
      eq(contracts.status, "active"),
      sql`${contracts.endDate} >= ${now.toISOString().slice(0, 10)}`,
      sql`${contracts.endDate} <= ${until.toISOString().slice(0, 10)}`,
    ),
  });
  return rows.map((contract) => ({
    id: contract.id,
    renterId: contract.renterId,
    motelId: contract.motelId,
    endDate: contract.endDate,
    eventKey: `contract:${contract.id}:expiry:${contract.endDate}:${windowDays}`,
  }));
}

type ContractReader = Pick<Db, "select">;

export async function listBillableContractsForMotel(
  motelId: string,
  reader: ContractReader = db,
): Promise<
  Array<{
    id: string;
    roomId: string;
    renterId: string;
    monthlyRent: VndString;
  }>
> {
  return reader
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
export async function countContractTemplatesForMotel(motelId: string): Promise<number> {
  return db.$count(contractTemplates, eq(contractTemplates.motelId, motelId));
}
export async function hasActiveContractForRoom(roomId: string): Promise<boolean> {
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
      and(
        eq(contracts.renterId, renterId),
        ...(motelId ? [eq(contracts.motelId, motelId)] : []),
        eq(contracts.status, "active"),
      ),
    )
    .orderBy(desc(contracts.createdAt), desc(contracts.id))
    .limit(1);
  if (!row) return null;
  return { ...row, roomName: (await getRoomName(row.roomId)) ?? "" };
}
