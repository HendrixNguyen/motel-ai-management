import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { managerAuth } from "@/middleware/manager-auth";
import { getSetupResult, setupMotel } from "./motel-setup.service";
import type { SetupMotelInput } from "./motel-setup.types";

const motelFee = t.Object({
  name: t.String({ minLength: 1 }),
  amount: t.String(),
});

const bankAccount = t.Object({
  bankCode: t.String({ minLength: 1 }),
  accountNumber: t.String({ minLength: 1 }),
  accountName: t.String({ minLength: 1 }),
});

const createMotelInputSchema = t.Object({
  name: t.String({ minLength: 1 }),
  address: t.Optional(t.Nullable(t.String())),
  electricityPrice: t.String(),
  waterPrice: t.String(),
  otherFees: t.Optional(t.Array(motelFee)),
  bankAccount: t.Optional(t.Nullable(bankAccount)),
});

const catalogSelectionSchema = t.Object({
  kind: t.Literal("catalog"),
  key: t.String({ minLength: 1 }),
  version: t.Integer({ minimum: 1 }),
});

const motelSelectionSchema = t.Object({
  kind: t.Literal("motel"),
  motelId: t.String({ format: "uuid" }),
  templateId: t.String({ format: "uuid" }),
  fingerprint: t.String({ minLength: 1 }),
});

const templateSelectionSchema = t.Union([catalogSelectionSchema, motelSelectionSchema]);

const setupRoomInputSchema = t.Object({
  name: t.String({ minLength: 1 }),
  basePrice: t.String(),
  floor: t.Optional(t.Nullable(t.Integer())),
});

const setupMotelInputSchema = t.Union([
  t.Object({
    requestId: t.String({ format: "uuid" }),
    mode: t.Literal("full"),
    motel: createMotelInputSchema,
    template: templateSelectionSchema,
    rooms: t.Array(setupRoomInputSchema),
  }),
  t.Object({
    requestId: t.String({ format: "uuid" }),
    mode: t.Literal("quick"),
    motel: createMotelInputSchema,
    template: t.Optional(templateSelectionSchema),
  }),
]);

export const motelSetupRoutes = new Elysia({ name: "motel-setup-routes" })
  .use(cookie())
  .use(managerAuth)
  .post(
    "/manager/motels/setup",
    async ({ body, auth, set }) => {
      const input = body as SetupMotelInput;
      const { result, replayed } = await setupMotel(auth!.userId, input);
      set.status = replayed ? 200 : 201;
      return result;
    },
    {
      body: setupMotelInputSchema,
      detail: { security: [{ managerAuth: [] }] },
    },
  )
  .get(
    "/manager/motels/setup-requests/:requestId",
    async ({ params, auth }) => {
      return getSetupResult(auth!.userId, params.requestId);
    },
    {
      params: t.Object({ requestId: t.String({ format: "uuid" }) }),
      detail: { security: [{ managerAuth: [] }] },
    },
  );
