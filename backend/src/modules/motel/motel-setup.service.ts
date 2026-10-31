import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, type DbTransaction } from "@/db";
import { AppError } from "@/shared/errors";
import { parseAmount } from "@/shared/money";
import { copySetupTemplate } from "@/modules/contract/contract.service";
import { createSetupRooms } from "@/modules/room/room.service";
import { motelSetupRequests } from "./motel-setup.schema";
import { motels } from "./motel.schema";
import { createMotelInTransaction, lockMotelSetup } from "./motel.service";
import type { SetupMotelInput, SetupMotelResult } from "./motel-setup.types";

function computeSetupFingerprint(input: SetupMotelInput): string {
  const normalized = {
    mode: input.mode,
    motel: {
      name: input.motel.name.trim(),
      address: input.motel.address ? input.motel.address.trim() : null,
      electricityPrice: parseAmount(input.motel.electricityPrice),
      waterPrice: parseAmount(input.motel.waterPrice),
      otherFees: (input.motel.otherFees ?? []).map((f) => ({
        name: f.name.trim(),
        amount: parseAmount(f.amount),
      })),
      bankAccount: input.motel.bankAccount
        ? {
            bankCode: input.motel.bankAccount.bankCode.trim(),
            accountNumber: input.motel.bankAccount.accountNumber.trim(),
            accountName: input.motel.bankAccount.accountName.trim(),
          }
        : null,
    },
    template: input.template
      ? input.template.kind === "catalog"
        ? {
            kind: "catalog",
            key: input.template.key,
            version: input.template.version,
          }
        : {
            kind: "motel",
            motelId: input.template.motelId,
            templateId: input.template.templateId,
            fingerprint: input.template.fingerprint,
          }
      : null,
    rooms:
      input.mode === "full"
        ? input.rooms.map((r) => ({
            name: r.name.trim(),
            basePrice: parseAmount(r.basePrice),
            floor: r.floor ?? null,
          }))
        : [],
  };

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export async function setupMotel(
  managerId: string,
  input: SetupMotelInput,
): Promise<{ result: SetupMotelResult; replayed: boolean }> {
  if (input.mode === "full") {
    if (!input.rooms || input.rooms.length < 1 || input.rooms.length > 100) {
      throw AppError.badRequest("Số lượng phòng phải từ 1 đến 100");
    }
  }

  const fingerprint = computeSetupFingerprint(input);

  return db.transaction(async (tx: DbTransaction) => {
    await lockMotelSetup(tx, managerId);

    const [existingReq] = await tx
      .select()
      .from(motelSetupRequests)
      .where(
        and(
          eq(motelSetupRequests.managerId, managerId),
          eq(motelSetupRequests.requestId, input.requestId),
        ),
      )
      .limit(1);

    if (existingReq) {
      if (existingReq.fingerprint !== fingerprint || existingReq.mode !== input.mode) {
        throw new AppError(
          "IDEMPOTENCY_CONFLICT",
          "Yêu cầu thiết lập trùng lặp nhưng nội dung khác",
        );
      }

      if (!existingReq.motelId) {
        throw new AppError("SETUP_RESULT_DELETED", "Nhà trọ của yêu cầu thiết lập đã bị xóa");
      }

      return {
        result: {
          motelId: existingReq.motelId,
          mode: existingReq.mode as "full" | "quick",
          roomCount: existingReq.roomCount,
          templateId: existingReq.templateId,
        },
        replayed: true,
      };
    }

    const motelCount = await tx.$count(motels, eq(motels.managerId, managerId));
    if (motelCount === 0 && input.mode === "quick") {
      throw new AppError(
        "MOTEL_SETUP_REQUIRED",
        "Chưa có nhà trọ nào. Vui lòng thiết lập đầy đủ thông tin nhà trọ đầu tiên.",
      );
    }

    const createdMotel = await createMotelInTransaction(tx, managerId, input.motel);

    let templateId: string | null = null;
    if (input.template) {
      const createdTemplate = await copySetupTemplate(
        tx,
        managerId,
        createdMotel.id,
        input.template,
        true,
      );
      templateId = createdTemplate.id;
    }

    let roomCount = 0;
    if (input.mode === "full") {
      const createdRooms = await createSetupRooms(
        tx,
        createdMotel.id,
        managerId,
        input.rooms.map((r) => ({
          name: r.name.trim(),
          basePrice: r.basePrice,
          floor: r.floor ?? null,
        })),
      );
      roomCount = createdRooms.length;
    }

    await tx.insert(motelSetupRequests).values({
      managerId,
      requestId: input.requestId,
      fingerprint,
      motelId: createdMotel.id,
      templateId,
      mode: input.mode,
      roomCount,
    });

    return {
      result: {
        motelId: createdMotel.id,
        mode: input.mode,
        roomCount,
        templateId,
      },
      replayed: false,
    };
  });
}

export async function getSetupResult(
  managerId: string,
  requestId: string,
): Promise<SetupMotelResult> {
  return db.transaction(async (tx: DbTransaction) => {
    await lockMotelSetup(tx, managerId);

    const [req] = await tx
      .select()
      .from(motelSetupRequests)
      .where(
        and(
          eq(motelSetupRequests.managerId, managerId),
          eq(motelSetupRequests.requestId, requestId),
        ),
      )
      .limit(1);

    if (!req) {
      throw AppError.notFound("Không tìm thấy kết quả thiết lập");
    }

    if (!req.motelId) {
      throw new AppError("SETUP_RESULT_DELETED", "Nhà trọ của yêu cầu thiết lập đã bị xóa");
    }

    return {
      motelId: req.motelId,
      mode: req.mode as "full" | "quick",
      roomCount: req.roomCount,
      templateId: req.templateId,
    };
  });
}
