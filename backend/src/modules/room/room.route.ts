import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { managerAuth } from "@/middleware/manager-auth";
import {
  createRoom,
  deleteRoom,
  getRoom,
  listRooms,
  updateRoom,
} from "./room.service";
import { INT4_MAX, INT4_MIN, roomStatus } from "./room.schema";
import type {
  CreateRoomInput,
  ListRoomsFilters,
  UpdateRoomInput,
} from "./room.types";

/**
 * `motelId` and `roomId` are `uuid` columns, so a path segment that is not a uuid has to fail
 * as a 400 here. Left as a bare string it reaches PostgreSQL, which raises `invalid input syntax
 * for type uuid` — a driver message the error handler can only report as a 500.
 */
const motelParams = t.Object({ motelId: t.String({ format: "uuid" }) });
const roomParams = t.Object({
  motelId: t.String({ format: "uuid" }),
  roomId: t.String({ format: "uuid" }),
});

/**
 * `t.Union` over the `room_status` values. A plain `t.String()` would accept `?status=vacant`
 * and hand it to the query, where an unknown value silently matches nothing — the caller would
 * read "no rooms match" where they sent a typo. The union turns it into a 400 at the edge.
 *
 * Built from `roomStatus.enumValues` so the route cannot accept a status the column does not
 * store, and cannot drift from it either.
 */
const statusSchema = t.Union(roomStatus.enumValues.map((value) => t.Literal(value)));

/**
 * `floor` is an `integer` column, and a bare `t.Integer()` imposes no bound at all — so
 * `?floor=3000000000` reaches PostgreSQL and comes back as `22003 numeric_value_out of range`,
 * which the shared handler reports as a 500. That is the same mistake the uuid params above guard
 * against, one column over. The bounds are read from the schema module so they cannot drift from
 * the column they protect.
 */
const floor = t.Integer({ minimum: INT4_MIN, maximum: INT4_MAX });

/**
 * A filter that is present but not understood is an error, never a filter that matches nothing:
 * `?floor=abc` and `?status=vacant` are both 400. An unknown parameter is dropped instead, which
 * is why `?roomId=` narrows nothing.
 */
const listQuery = t.Object({
  floor: t.Optional(floor),
  status: t.Optional(statusSchema),
  search: t.Optional(t.String()),
});

/**
 * `basePrice` is typed `string` here so the shape matches `CreateRoomInput`; the digits *and* the
 * magnitude are checked by `parseAmount` in the service, because a `t.String()` cannot tell
 * `"20k"` from `"20000"`, and a bad amount must be a 400, never a 500 from the column. The type
 * also rejects a JSON number here, so a float cannot enter the pipeline at all.
 */
const createBody = t.Object({
  name: t.String({ minLength: 1 }),
  basePrice: t.String(),
  floor: t.Optional(t.Nullable(floor)),
  status: t.Optional(statusSchema),
});

const updateBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  basePrice: t.Optional(t.String()),
  floor: t.Optional(t.Nullable(floor)),
  status: t.Optional(statusSchema),
});

export const roomRoutes = new Elysia({ name: "room-routes" })
  .use(cookie())
  .use(managerAuth)
  .get(
    "/manager/motels/:motelId/rooms",
    async ({ params, query, auth }) => {
      // The annotation is the guarantee that route validation and the service input agree; it
      // stops compiling the moment they drift apart.
      const filters: ListRoomsFilters = query;
      return listRooms(params.motelId, auth!.userId, filters);
    },
    {
      params: motelParams,
      query: listQuery,
      detail: { security: [{ managerAuth: [] }] },
    },
  )
  .post(
    "/manager/motels/:motelId/rooms",
    async ({ params, body, auth, set }) => {
      const input: CreateRoomInput = body;
      const room = await createRoom(params.motelId, auth!.userId, input);
      set.status = 201;
      return room;
    },
    {
      params: motelParams,
      body: createBody,
      detail: { security: [{ managerAuth: [] }] },
    },
  )
  .get(
    "/manager/motels/:motelId/rooms/:roomId",
    async ({ params, auth }) => getRoom(params.roomId, params.motelId, auth!.userId),
    {
      params: roomParams,
      detail: { security: [{ managerAuth: [] }] },
    },
  )
  .patch(
    "/manager/motels/:motelId/rooms/:roomId",
    async ({ params, body, auth }) => {
      const input: UpdateRoomInput = body;
      return updateRoom(params.roomId, params.motelId, auth!.userId, input);
    },
    {
      params: roomParams,
      body: updateBody,
      detail: { security: [{ managerAuth: [] }] },
    },
  )
  .delete(
    "/manager/motels/:motelId/rooms/:roomId",
    async ({ params, auth, set }) => {
      await deleteRoom(params.roomId, params.motelId, auth!.userId);
      set.status = 204;
      return "";
    },
    {
      params: roomParams,
      detail: { security: [{ managerAuth: [] }] },
    },
  );