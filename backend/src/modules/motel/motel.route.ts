import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { managerAuth } from "@/middleware/manager-auth";
import {
  createMotel,
  deleteMotel,
  getMotel,
  listMotels,
  updateMotel,
} from "./motel.service";
import type { CreateMotelInput, UpdateMotelInput } from "./motel.types";

/**
 * `motelId` is a `uuid` column, so a path that is not a uuid has to fail as a 400 here.
 * Left as a bare string it reaches PostgreSQL, which raises `invalid input syntax for type
 * uuid` — a driver message the error handler can only report as a 500.
 */
const motelIdParams = t.Object({ motelId: t.String({ format: "uuid" }) });

/**
 * `amount` is typed `string` here so the shape matches `MotelFeeInput`; the digits themselves
 * are checked by `parseVnd` in the service, because a `t.String()` cannot tell `"20k"` from
 * `"20000"` and a bad amount must be a 400, never a 500 from the column.
 */
const motelFee = t.Object({ name: t.String({ minLength: 1 }), amount: t.String() });

const bankAccount = t.Object({
  bankCode: t.String({ minLength: 1 }),
  accountNumber: t.String({ minLength: 1 }),
  accountName: t.String({ minLength: 1 }),
});

export const motelRoutes = new Elysia({ name: "motel-routes" })
  .use(cookie())
  .use(managerAuth)
  .get("/manager/motels", async ({ auth }) => listMotels(auth!.userId), {
    detail: { security: [{ managerAuth: [] }] },
  })
  .post(
    "/manager/motels",
    async ({ body, auth, set }) => {
      // The annotation is the guarantee that route validation and the service input agree;
      // it stops compiling the moment they drift apart.
      const input: CreateMotelInput = body;
      const motel = await createMotel(auth!.userId, input);
      set.status = 201;
      return motel;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        address: t.Optional(t.Nullable(t.String())),
        electricityPrice: t.String(),
        waterPrice: t.String(),
        otherFees: t.Optional(t.Array(motelFee)),
        bankAccount: t.Optional(t.Nullable(bankAccount)),
      }),
      detail: { security: [{ managerAuth: [] }] },
    },
  )
  .get(
    "/manager/motels/:motelId",
    async ({ params, auth }) => getMotel(params.motelId, auth!.userId),
    {
      params: motelIdParams,
      detail: { security: [{ managerAuth: [] }] },
    },
  )
  .patch(
    "/manager/motels/:motelId",
    async ({ params, body, auth }) => {
      const input: UpdateMotelInput = body;
      return updateMotel(params.motelId, auth!.userId, input);
    },
    {
      params: motelIdParams,
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        address: t.Optional(t.Nullable(t.String())),
        electricityPrice: t.Optional(t.String()),
        waterPrice: t.Optional(t.String()),
        otherFees: t.Optional(t.Array(motelFee)),
        bankAccount: t.Optional(t.Nullable(bankAccount)),
      }),
      detail: { security: [{ managerAuth: [] }] },
    },
  )
  .delete(
    "/manager/motels/:motelId",
    async ({ params, auth, set }) => {
      await deleteMotel(params.motelId, auth!.userId);
      set.status = 204;
      return "";
    },
    {
      params: motelIdParams,
      detail: { security: [{ managerAuth: [] }] },
    },
  );