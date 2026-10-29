import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { managerAuditEvents, managers } from "./auth.schema";
import { AppError } from "@/shared/errors";
import { SUPERADMIN_EMAIL } from "./superadmin-identity";

export async function listAccounts(limit = 50, offset = 0) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isInteger(offset) ||
    offset < 0
  )
    throw AppError.badRequest("Giới hạn phân trang không hợp lệ");
  return db
    .select({
      id: managers.id,
      email: managers.email,
      name: managers.name,
      phone: managers.phone,
      role: managers.role,
      disabledAt: managers.disabledAt,
      passwordReady: sql<boolean>`${managers.passwordHash} IS NOT NULL`,
      createdAt: managers.createdAt,
    })
    .from(managers)
    .where(eq(managers.role, "manager"))
    .orderBy(managers.createdAt)
    .limit(limit)
    .offset(offset);
}

export async function createManager(
  input: { email: string; name: string; password: string; phone?: string },
  actorId: string,
) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (email === SUPERADMIN_EMAIL)
    throw AppError.conflict("Email này được dành riêng cho tài khoản quản trị nền tảng");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw AppError.badRequest("Email không hợp lệ");
  if (!name) throw AppError.badRequest("Họ tên không được để trống");
  if (input.password.length < 8 || input.password.length > 256)
    throw AppError.badRequest("Mật khẩu phải có từ 8 đến 256 ký tự");
  try {
    const [account] = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(managers)
        .values({
          email,
          name,
          phone: input.phone?.trim() || null,
          passwordHash: await Bun.password.hash(input.password, { algorithm: "argon2id" }),
          role: "manager",
        })
        .returning();
      await tx
        .insert(managerAuditEvents)
        .values({ actorId, targetId: created!.id, action: "manager.created" });
      return [created!];
    });
    return publicAccount(account);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505")
      throw AppError.conflict("Email đã được sử dụng");
    throw error;
  }
}

function publicAccount(account: typeof managers.$inferSelect) {
  const { passwordHash: _passwordHash, ...safe } = account;
  return safe;
}

export async function setManagerEnabled(managerId: string, enabled: boolean, actorId: string) {
  if (typeof enabled !== "boolean") throw AppError.badRequest("Trạng thái không hợp lệ");
  await db.transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(managers)
      .where(eq(managers.id, managerId))
      .for("update")
      .limit(1);
    if (!account || account.role !== "manager") throw AppError.notFound("Không tìm thấy tài khoản");
    if (Boolean(account.disabledAt) === !enabled) return;
    await tx
      .update(managers)
      .set({ disabledAt: enabled ? null : new Date(), sessionVersion: account.sessionVersion + 1 })
      .where(eq(managers.id, managerId));
    await tx.insert(managerAuditEvents).values({
      actorId,
      targetId: managerId,
      action: enabled ? "manager.enabled" : "manager.disabled",
    });
  });
}

export async function resetManagerPassword(managerId: string, password: string, actorId: string) {
  if (password.length < 8 || password.length > 256)
    throw AppError.badRequest("Mật khẩu phải có từ 8 đến 256 ký tự");
  const passwordHash = await Bun.password.hash(password, { algorithm: "argon2id" });
  await db.transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(managers)
      .where(eq(managers.id, managerId))
      .for("update")
      .limit(1);
    if (!account || account.role !== "manager") throw AppError.notFound("Không tìm thấy tài khoản");
    await tx
      .update(managers)
      .set({ passwordHash, sessionVersion: account.sessionVersion + 1 })
      .where(eq(managers.id, managerId));
    await tx
      .insert(managerAuditEvents)
      .values({ actorId, targetId: managerId, action: "manager.password_reset" });
  });
}
