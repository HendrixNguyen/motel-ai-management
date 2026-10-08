import { and, eq, isNull, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { env } from "@/config";
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

  // The landing route is `/r/[token]` (frontend-ui-specs.md R0) — the renter portal's only
  // token-bearing route. A link built for any other path 404s on arrival.
  const url = `${env.frontendUrl}/r/${token}`;

  return { token, expiresAt, url };
}

export async function consumeMagicLink(token: string): Promise<RenterRow> {
  const now = new Date();
  const [claimed] = await db
    .update(magicLinks)
    .set({ consumedAt: now })
    .where(and(eq(magicLinks.token, token), isNull(magicLinks.consumedAt), sql`${magicLinks.expiresAt} > ${now}`))
    .returning({ renterId: magicLinks.renterId });

  if (!claimed) throw new AppError("MAGIC_LINK_EXPIRED", "Liên kết không hợp lệ hoặc đã hết hạn");

  const renter = await db.query.renters.findFirst({ where: eq(renters.id, claimed.renterId) });
  if (!renter) throw AppError.notFound("Không tìm thấy người thuê");

  return renter;
}