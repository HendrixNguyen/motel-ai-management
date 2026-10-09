import { eq } from "drizzle-orm";
import { db } from "@/db";
import { managers } from "./auth.schema";
import { AppError } from "@/shared/errors";
import type { ManagerRow, RegisterManagerInput } from "./auth.types";

const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=65536,t=2,p=1$xb7Q5Ed5Qct87cjmObi7MsMzUVSrdFUCPjZorR10kdQ$tYXEJRr3lz6VsEXvsj4VyTXTSM0IsH1DguruH2x6tYU";

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
      passwordHash: await Bun.password.hash(input.password, { algorithm: "argon2id" }),
    })
    .returning();
  return row!;
}

export async function verifyManager(email: string, password: string): Promise<ManagerRow> {
  const normalizedEmail = email.trim().toLowerCase();
  const row = await db.query.managers.findFirst({
    where: eq(managers.email, normalizedEmail),
  });
  const passwordHash = row?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const validPassword = await Bun.password.verify(password, passwordHash);
  if (!row || !validPassword) {
    throw AppError.unauthorized("Email hoặc mật khẩu không đúng");
  }
  return row;
}