import { eq } from "drizzle-orm";
import { db } from "@/db";
import { managers } from "./auth.schema";
import { AppError } from "@/shared/errors";
import type { ManagerRow } from "./auth.types";

export async function registerManager(input: {
  email: string;
  password: string;
  name: string;
  phone?: string;
}): Promise<ManagerRow> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (email === "manage@example.com")
    throw AppError.conflict("Email này được dành riêng cho tài khoản quản trị nền tảng");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw AppError.badRequest("Email không hợp lệ");
  if (input.password.length < 8 || input.password.length > 256)
    throw AppError.badRequest("Mật khẩu phải có từ 8 đến 256 ký tự");
  if (!name || name.length > 160) throw AppError.badRequest("Họ tên không hợp lệ");
  try {
    const [row] = await db.transaction(async (tx) => {
      const [manager] = await tx
        .insert(managers)
        .values({
          email,
          name,
          phone: input.phone?.trim() || null,
          passwordHash: await Bun.password.hash(input.password, { algorithm: "argon2id" }),
          role: "manager",
        })
        .returning();
      return [manager!];
    });
    return row;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505")
      throw AppError.conflict("Email đã được sử dụng");
    throw error;
  }
}

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=2,p=1$xb7Q5Ed5Qct87cjmObi7MsMzUVSrdFUCPjZorR10kdQ$tYXEJRr3lz6VsEXvsj4VyTXTSM0IsH1DguruH2x6tYU";

export async function verifyManager(email: string, password: string): Promise<ManagerRow> {
  const normalizedEmail = email.trim().toLowerCase();
  const row = await db.query.managers.findFirst({
    where: eq(managers.email, normalizedEmail),
  });
  const passwordHash = row?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const validPassword = await Bun.password.verify(password, passwordHash);
  if (!row || !validPassword || row.disabledAt || !row.passwordHash) {
    throw AppError.unauthorized("Email hoặc mật khẩu không đúng");
  }
  return row;
}
