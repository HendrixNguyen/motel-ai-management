import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { eq } from "drizzle-orm";
import { env } from "@/config";
import { AppError } from "@/shared/errors";
import { db } from "@/db";
import { renters } from "@/modules/renter/renter.schema";

export type RenterAuthPayload = { renterId: string; motelId: string };

interface JwtPayload {
  renterId: string;
  motelId: string;
}

export const renterAuth = new Elysia({ name: "renter-auth" })
  .use(jwt({ name: "renter", secret: env.renterSessionSecret, exp: "30d" }))
  .derive({ as: "scoped" }, async ({ renter, cookie }) => {
    const renterCookie = cookie?.renter_session as { value: string } | undefined;
    const token = renterCookie?.value;

    if (!token) {
      return { auth: undefined as RenterAuthPayload | undefined };
    }

    const payload = await renter.verify(token);
    if (!payload || typeof payload !== "object" || !("renterId" in payload)) {
      return { auth: undefined as RenterAuthPayload | undefined };
    }

    const renterRow = await db.query.renters.findFirst({
      where: eq(renters.id, (payload as unknown as JwtPayload).renterId),
    });

    if (!renterRow) {
      return { auth: undefined as RenterAuthPayload | undefined };
    }

    return { auth: { renterId: renterRow.id, motelId: renterRow.motelId } };
  })
  .onBeforeHandle({ as: "scoped" }, ({ auth, set }) => {
    if (!auth) {
      set.status = 401;
      return { error: "Chưa đăng nhập", code: "UNAUTHORIZED" };
    }
  });