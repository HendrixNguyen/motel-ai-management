import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { AppError } from "@/shared/errors";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { renters } from "./renter.schema";
import { managerAuth } from "@/middleware/manager-auth";
import {
  createRenterForMotel,
  deleteRenter,
  getRenterById,
  getRenterCccdMetadata,
  listRenters,
  setRenterCccdMetadata,
  updateRenter,
  type RenterCccdSide,
} from "./renter.service";
import { StorageError, validateStorageInput, type StorageAdapter } from "@/shared/storage";
import { renterStatus } from "./renter.schema";
import type {
  CreateRenterInput,
  ListRentersFilters,
  UpdateRenterInput,
} from "./renter.types";

/**
 * `motelId` and `renterId` are `uuid` columns, so a path segment that is not a uuid has to fail
 * as a 400 here. Left as a bare string it reaches PostgreSQL, which raises `invalid input syntax
 * for type uuid` — a driver message the error handler can only report as a 500.
 */
const motelParams = t.Object({ motelId: t.String({ format: "uuid" }) });
const renterParams = t.Object({
  motelId: t.String({ format: "uuid" }),
  renterId: t.String({ format: "uuid" }),
});

/**
 * `t.Union` over the `renter_status` values. A plain `t.String()` would accept `?status=vacant`
 * and hand it to the query, where an unknown value silently matches nothing — the caller would
 * read "no renters match" where they sent a typo. The union turns it into a 400 at the edge.
 *
 * Built from `renterStatus.enumValues` so the route cannot accept a status the column does not
 * store, and cannot drift from it either.
 */
const statusSchema = t.Union(renterStatus.enumValues.map((value) => t.Literal(value)));

/**
 * `renters.room_id` is a `uuid` column, so the same bound as the path params protects the filter
 * and the body: `?roomId=khong-phai-uuid` must be a 400, not a 500 from PostgreSQL.
 */
const roomId = t.String({ format: "uuid" });

/**
 * A filter that is present but not understood is an error, never a filter that matches nothing:
 * `?status=vacant` is a 400. An unknown parameter is dropped instead, which is why `?name=` does
 * nothing.
 */
const listQuery = t.Object({
  status: t.Optional(statusSchema),
  roomId: t.Optional(roomId),
  search: t.Optional(t.String()),
});

/**
 * `phone` is typed as a string and left unvalidated here on purpose. Whether `0901234567`,
 * `+84 901 234 567` and `84901234567` are the same person is `normalisePhone`'s judgement, and it
 * answers the wrong one with a Vietnamese 400 — the same answer whoever is asking. The type also
 * rejects a JSON number, so a phone cannot arrive as a float.
 *
 * There is no `status` on create: a renter starts active, and the row a manager can create should
 * never be a tenancy that never existed. It becomes settable through a patch.
 */
const createBody = t.Object({
  name: t.String({ minLength: 1 }),
  phone: t.String({ minLength: 1 }),
  idNumber: t.Optional(t.Nullable(t.String())),
  roomId: t.Optional(t.Nullable(roomId)),
});

let cccdStorage: StorageAdapter | undefined;
export function configureCccdStorage(storage: StorageAdapter): void { cccdStorage = storage; }
function requireCccdStorage(): StorageAdapter { if (!cccdStorage) throw AppError.externalService("Lưu trữ tệp chưa được cấu hình"); return cccdStorage; }

async function deleteUnreferencedCccdObject(storage: StorageAdapter, objectKey: string): Promise<void> {
  const [front, back] = await Promise.all([
    db.query.renters.findFirst({ where: eq(renters.idCardFrontObjectKey, objectKey), columns: { id: true } }),
    db.query.renters.findFirst({ where: eq(renters.idCardBackObjectKey, objectKey), columns: { id: true } }),
  ]);
  if (!front && !back) await storage.delete(objectKey).catch(() => undefined);
}

const cccdParams = t.Object({ motelId: t.String({ format: "uuid" }), renterId: t.String({ format: "uuid" }), side: t.Union([t.Literal("front"), t.Literal("back")]) });
const cccdUploadBody = t.Object({ file: t.File({ type: ["image/jpeg", "image/png"], maxSize: "5m" }) });

const updateBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  phone: t.Optional(t.String({ minLength: 1 })),
  idNumber: t.Optional(t.Nullable(t.String())),
  roomId: t.Optional(t.Nullable(roomId)),
  status: t.Optional(statusSchema),
});

export const renterRoutes = new Elysia({ name: "renter-routes" })
  .use(cookie())
  .use(managerAuth)
  .get(
    "/manager/motels/:motelId/renters",
    async ({ params, query, auth }) => {
      // The annotation is the guarantee that route validation and the service input agree; it
      // stops compiling the moment they drift apart.
      const filters: ListRentersFilters = query;
      return listRenters(params.motelId, auth!.userId, filters);
    },
    {
      params: motelParams,
      query: listQuery,
      detail: { security: [{ managerAuth: [] }] },
    },
  )
  .post(
    "/manager/motels/:motelId/renters",
    async ({ params, body, auth, set }) => {
      const input: CreateRenterInput = body;
      const renter = await createRenterForMotel(params.motelId, auth!.userId, input);
      set.status = 201;
      return renter;
    },
    {
      params: motelParams,
      body: createBody,
      detail: { security: [{ managerAuth: [] }] },
    },
  )
  .get(
    "/manager/motels/:motelId/renters/:renterId",
    async ({ params, auth }) => getRenterById(params.renterId, params.motelId, auth!.userId),
    {
      params: renterParams,
      detail: { security: [{ managerAuth: [] }] },
    },
  )
  .patch(
    "/manager/motels/:motelId/renters/:renterId",
    async ({ params, body, auth }) => {
      const input: UpdateRenterInput = body;
      return updateRenter(params.renterId, params.motelId, auth!.userId, input);
    },
    {
      params: renterParams,
      body: updateBody,
      detail: { security: [{ managerAuth: [] }] },
    },
  )
  .post("/manager/motels/:motelId/renters/:renterId/cccd/:side", async ({ params, body, auth, set }) => {
    const file = (body as { file: File }).file;
    if (file.size > 5_000_000) throw AppError.badRequest("Tệp vượt quá giới hạn 5 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const side = params.side as RenterCccdSide;
    const objectKey = `motels/${params.motelId}/renters/${params.renterId}/cccd/${side}/${crypto.randomUUID()}`;
    let stored: Awaited<ReturnType<StorageAdapter["put"]>>;
    try {
      await validateStorageInput({ objectKey, body: bytes, contentType: file.type as "image/jpeg" | "image/png", maxBytes: 5_000_000 });
      stored = await requireCccdStorage().put({ objectKey, body: bytes, contentType: file.type as "image/jpeg" | "image/png", maxBytes: 5_000_000 });
    } catch (error) {
      if (error instanceof StorageError) throw AppError.badRequest(error.message);
      throw AppError.externalService();
    }
    try {
      const { oldObjectKey } = await setRenterCccdMetadata(params.renterId, params.motelId, auth!.userId, side, { ...stored, contentType: stored.contentType as "image/jpeg" | "image/png" });
      if (oldObjectKey) await deleteUnreferencedCccdObject(requireCccdStorage(), oldObjectKey);
      set.status = 201;
      return { side, uploaded: true, contentType: stored.contentType, size: stored.size };
    } catch (error) {
      await deleteUnreferencedCccdObject(requireCccdStorage(), stored.objectKey);
      throw error;
    }
  }, { params: cccdParams, body: cccdUploadBody, detail: { security: [{ managerAuth: [] }] } })
  .get("/manager/motels/:motelId/renters/:renterId/cccd/:side", async ({ params, auth }) => {
    const side = params.side as RenterCccdSide;
    const metadata = await getRenterCccdMetadata(params.renterId, params.motelId, auth!.userId, side);
    if (!metadata) throw AppError.notFound("Không tìm thấy ảnh CCCD");
    try { return { side, url: await requireCccdStorage().createSignedDownload(metadata.objectKey, 300), contentType: metadata.contentType, size: metadata.size }; }
    catch { throw AppError.externalService(); }
  }, { params: cccdParams, detail: { security: [{ managerAuth: [] }] } })
  .delete(
    "/manager/motels/:motelId/renters/:renterId",
    async ({ params, auth, set }) => {
      await deleteRenter(params.renterId, params.motelId, auth!.userId);
      set.status = 204;
      return "";
    },
    {
      params: renterParams,
      detail: { security: [{ managerAuth: [] }] },
    },
  );
