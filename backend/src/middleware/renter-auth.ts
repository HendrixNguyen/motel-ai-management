import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { and, eq } from "drizzle-orm";
import { env } from "@/config";
import { AppError } from "@/shared/errors";
import { db } from "@/db";
import { renters } from "@/modules/renter/renter.schema";

export type RenterAuthPayload = { renterId: string; motelId: string };

interface JwtPayload {
  renterId: string;
  motelId: string;
}

export function requireRenterAuth(auth: RenterAuthPayload | undefined): RenterAuthPayload {
  if (!auth) throw AppError.unauthorized();
  return auth;
}

function isJwtPayload(payload: unknown): payload is JwtPayload {
  return typeof payload === "object" && payload !== null && "renterId" in payload && typeof payload.renterId === "string" && "motelId" in payload && typeof payload.motelId === "string";
}

export const renterAuth = new Elysia({ name: "renter-auth" })
  .use(jwt({ name: "renter", secret: env.renterSessionSecret, exp: "24h" }))
  .derive({ as: "scoped" }, async ({ renter, cookie }) => {
    const renterCookie = cookie?.renter_session as { value: string } | undefined;
    const token = renterCookie?.value;

    if (!token) {
      return { auth: undefined as RenterAuthPayload | undefined };
    }

    const payload = await renter.verify(token);
    if (!isJwtPayload(payload)) {
      return { auth: undefined as RenterAuthPayload | undefined };
    }

    const renterRow = await db.query.renters.findFirst({
      where: and(eq(renters.id, payload.renterId), eq(renters.motelId, payload.motelId), eq(renters.status, "active")),
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