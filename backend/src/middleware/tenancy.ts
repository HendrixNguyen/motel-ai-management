import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { motels } from "@/modules/motel/motel.schema";
import { AppError } from "@/shared/errors";

export type MotelRow = typeof motels.$inferSelect;

export async function resolveOwnedMotel(motelId: string, managerId: string): Promise<MotelRow> {
  const row = await db.query.motels.findFirst({
    where: and(eq(motels.id, motelId), eq(motels.managerId, managerId)),
  });
  if (!row) {
    throw AppError.notFound("Không tìm thấy nhà trọ");
  }
  return row;
}