import { and, eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@/db";
import { magicLinks } from "@/modules/auth/auth.schema";
import { renters } from "@/modules/renter/renter.schema";
import { AppError } from "@/shared/errors";

export type RenterRow = typeof renters.$inferSelect;

const TOKEN_BYTES = 32;
const TTL_HOURS = 24;

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export async function issueMagicLink(renterId: string): Promise<{ token: string; expiresAt: Date; url: string }> {
  const renter = await db.query.renters.findFirst({ where: eq(renters.id, renterId) });
  if (!renter) throw AppError.notFound("Không tìm thấy người thuê");

  const token = generateToken();
  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);

  await db.insert(magicLinks).values({
    renterId,
    token,
    expiresAt,
  });

  const baseUrl = process.env.RENTER_PORTAL_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/renter/${token}`;

  return { token, expiresAt, url };
}

export async function consumeMagicLink(token: string): Promise<RenterRow> {
  const link = await db.query.magicLinks.findFirst({
    where: eq(magicLinks.token, token),
  });

  if (!link) throw new AppError("MAGIC_LINK_EXPIRED", "Liên kết không hợp lệ hoặc đã hết hạn");

  if (link.consumedAt) throw new AppError("MAGIC_LINK_EXPIRED", "Liên kết không hợp lệ hoặc đã hết hạn");

  if (link.expiresAt < new Date()) throw new AppError("MAGIC_LINK_EXPIRED", "Liên kết không hợp lệ hoặc đã hết hạn");

  await db
    .update(magicLinks)
    .set({ consumedAt: new Date() })
    .where(eq(magicLinks.token, token));

  const renter = await db.query.renters.findFirst({ where: eq(renters.id, link.renterId) });
  if (!renter) throw AppError.notFound("Không tìm thấy người thuê");

  return renter;
}