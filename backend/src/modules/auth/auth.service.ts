import { hash, verify } from "argon2";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { managers } from "./auth.schema";
import { AppError } from "@/shared/errors";
import type { ManagerRow, RegisterManagerInput } from "./auth.types";

export async function registerManager(input: RegisterManagerInput): Promise<ManagerRow> {
  if (input.password.length < 8) {
    throw AppError.badRequest("Mật khẩu phải có ít nhất 8 ký tự");
  }

  const email = input.email.trim().toLowerCase();
  const existing = await db.query.managers.findFirst({ where: eq(managers.email, email) });
  if (existing) {
    throw AppError.conflict("Email đã được sử dụng");
  }

  const [row] = await db
    .insert(managers)
    .values({
      email,
      name: input.name,
      phone: input.phone,
      passwordHash: await hash(input.password),
    })
    .returning();
  return row!;
}

export async function verifyManager(email: string, password: string): Promise<ManagerRow> {
  const normalizedEmail = email.trim().toLowerCase();
  const row = await db.query.managers.findFirst({
    where: eq(managers.email, normalizedEmail),
  });
  if (!row || !(await verify(row.passwordHash, password))) {
    throw AppError.unauthorized("Email hoặc mật khẩu không đúng");
  }
  return row;
}