import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { managerAuth } from "@/middleware/manager-auth";
import {
  createRenterForMotel,
  deleteRenter,
  getRenterById,
  listRenters,
  updateRenter,
} from "./renter.service";
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
  idCardFrontUrl: t.Optional(t.Nullable(t.String())),
  idCardBackUrl: t.Optional(t.Nullable(t.String())),
  roomId: t.Optional(t.Nullable(roomId)),
});

const updateBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  phone: t.Optional(t.String({ minLength: 1 })),
  idNumber: t.Optional(t.Nullable(t.String())),
  idCardFrontUrl: t.Optional(t.Nullable(t.String())),
  idCardBackUrl: t.Optional(t.Nullable(t.String())),
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
