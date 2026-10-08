import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { resolveOwnedMotel, resolveRoomInMotel } from "@/middleware/tenancy";
import { listRecentInvoicesForRenter } from "@/modules/billing/billing.service";
import { getActiveContractForRenter } from "@/modules/contract/contract.service";
import { AppError } from "@/shared/errors";
import { normalisePhone } from "@/shared/phone";
import { renters } from "./renter.schema";
import type {
  CreateRenterInput,
  ListRentersFilters,
  RenterDetailResponse,
  RenterResponse,
  RenterStatus,
  UpdateRenterInput,
} from "./renter.types";

export type RenterRow = typeof renters.$inferSelect;

type RenterPatch = Partial<{
  name: string;
  phone: string;
  idNumber: string | null;
  idCardFrontUrl: string | null;
  idCardBackUrl: string | null;
  roomId: string | null;
  status: RenterStatus;
}>;

/** How many invoices the renter detail carries. The contract asks for the last five. */
const RECENT_INVOICE_LIMIT = 5;

/** The `renters_motel_id_phone_uq` index, named as PostgreSQL names it in a 23505 error. */
const RENTER_PHONE_UNIQUE = "renters_motel_id_phone_uq";

/** SQLSTATE for `unique_violation`. */
const UNIQUE_VIOLATION = "23505";

export async function getRenter(renterId: string): Promise<RenterRow | undefined> {
  return db.query.renters.findFirst({ where: eq(renters.id, renterId) });
}

/**
 * The insert itself. Widened from the four fields it started with to carry the CCCD and the two
 * card images, which is the whole of what a renter row is allowed to be given — nothing else
 * reaches it, and the `motelId` here is the one the tenancy check already proved.
 *
 * The phone is normalised before the write, so `renters_phone_normalised` can never fire: a
 * malformed number is a 400 the caller can read, not a 500 from the constraint.
 */
export async function createRenter(input: {
  motelId: string;
  name: string;
  phone: string;
  roomId?: string;
  idNumber?: string | null;
  idCardFrontUrl?: string | null;
  idCardBackUrl?: string | null;
}): Promise<RenterRow> {
  const phone = normalisePhone(input.phone);
  const [row] = await db
    .insert(renters)
    .values({ ...input, phone })
    .returning();
  return row!;
}

export async function getRenterForNotification(renterId: string, motelId: string): Promise<RenterRow | undefined> {
  return db.query.renters.findFirst({ where: and(eq(renters.id, renterId), eq(renters.motelId, motelId)) });
}

export async function mapZaloFollowerToRenter(motelId: string, phone: string, followerId: string): Promise<boolean> {
  const normalizedPhone = normalisePhone(phone);
  const rows = await db.update(renters).set({ zaloOaId: followerId, isOaFollower: true }).where(and(eq(renters.motelId, motelId), eq(renters.phone, normalizedPhone))).returning({ id: renters.id });
  return rows.length === 1;
}

export async function clearZaloFollower(followerId: string): Promise<void> {
  await db.update(renters).set({ zaloOaId: null, isOaFollower: false }).where(eq(renters.zaloOaId, followerId));
}

export async function getRenterByPhone(motelId: string, phone: string): Promise<RenterRow | undefined> {
  const normalizedPhone = normalisePhone(phone);
  return db.query.renters.findFirst({
    where: and(eq(renters.motelId, motelId), eq(renters.phone, normalizedPhone)),
  });
}

export async function countRentersForMotel(motelId: string): Promise<number> {
  return db.$count(renters, eq(renters.motelId, motelId));
}

/**
 * Renters still assigned to a room, whatever their status.
 *
 * The status is deliberately absent from the filter. `renters.room_id` is a foreign key with
 * `ON DELETE no action`, so an `inactive` renter left pointing at a room blocks its deletion
 * exactly as much as an active one — counting only the active rows would let the delete through
 * and turn a refusal the manager can read into a 500.
 */
export async function countRentersInRoom(roomId: string): Promise<number> {
  return db.$count(renters, eq(renters.roomId, roomId));
}

/**
 * `\` is PostgreSQL's default escape character inside `LIKE`/`ILIKE`, so escaping it along with
 * `%` and `_` is enough to make the search text match itself. Without this, `?search=100%` — a
 * plausible way to look for a renter — matches every renter in the motel.
 */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Drizzle rethrows a driver failure as `DrizzleQueryError`, whose `cause` is the `PostgresError`
 * carrying the SQLSTATE and the constraint name. Both layers are read so no check below depends on
 * the wrapper being there.
 */
function driverError(error: unknown): { code?: unknown; constraint_name?: unknown } {
  const driver = (error as { cause?: unknown } | null)?.cause ?? error;
  return (driver ?? {}) as { code?: unknown; constraint_name?: unknown };
}

/**
 * The unique index is the judge, not a `SELECT` first: two managers registering the same phone at
 * the same moment would both pass a pre-check and one insert would still lose. Reading
 * PostgreSQL's own refusal is also the only way to catch the violation at all — the route schema
 * cannot know which phones already exist, and neither can a second query written a moment earlier.
 */
function isDuplicatePhone(error: unknown): boolean {
  const { code, constraint_name } = driverError(error);
  return code === UNIQUE_VIOLATION && constraint_name === RENTER_PHONE_UNIQUE;
}

/**
 * `createdAt` is a `timestamptz`, and the contract asks for ISO-8601 UTC on the wire. Spelling
 * that out here is what lets `RenterResponse.createdAt` be a `string`.
 */
function toResponse(row: RenterRow): RenterResponse {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

/**
 * The renter is found by id *and* motel id in the same query. A renter id on its own says nothing
 * about the tenant, so looking the row up first and checking ownership afterwards would mean
 * answering questions about another manager's data before deciding the caller may not have it.
 */
async function resolveOwnedRenter(
  renterId: string,
  motelId: string,
  managerId: string,
): Promise<RenterRow> {
  await resolveOwnedMotel(motelId, managerId);

  const row = await db.query.renters.findFirst({
    where: and(eq(renters.id, renterId), eq(renters.motelId, motelId)),
  });
  if (!row) {
    throw AppError.notFound("Không tìm thấy người thuê");
  }
  return row;
}

export async function listRenters(
  motelId: string,
  managerId: string,
  filters: ListRentersFilters = {},
): Promise<RenterResponse[]> {
  await resolveOwnedMotel(motelId, managerId);

  const conditions = [eq(renters.motelId, motelId)];
  if (filters.roomId !== undefined) conditions.push(eq(renters.roomId, filters.roomId));
  if (filters.status !== undefined) conditions.push(eq(renters.status, filters.status));
  // An empty `?search=` is not a filter; treating it as `%` would quietly answer a question the
  // caller did not ask. A phone is matched in the form it is stored — `84901234567` — because
  // that is the form every response carries and the only one the column can hold.
  if (filters.search !== undefined && filters.search !== "") {
    const term = `%${escapeLike(filters.search)}%`;
    conditions.push(or(ilike(renters.name, term), ilike(renters.phone, term))!);
  }

  const rows = await db.query.renters.findMany({
    where: and(...conditions),
    orderBy: [asc(renters.name), asc(renters.id)],
  });
  return rows.map(toResponse);
}

/**
 * Tenant-scoped creation: the motel is proved first, the room is proved to belong to it, and only
 * then is anything written.
 *
 * The room check is what stops a manager filing a renter under a room of somebody else's motel —
 * a cross-tenant leak that would otherwise look like a perfectly valid assignment. It answers 404,
 * because a room id the caller may not name must be indistinguishable from one that does not
 * exist.
 *
 * The insert itself is the existing `createRenter`, so there is one place where a phone is
 * normalised and one place a renter row is written. Only the translation of the refusal is added
 * here, because only the tenant-scoped caller knows what the message should say.
 *
 * Nothing is sent to the renter. The welcome ZNS belongs to the sub-project that owns Zalo, and a
 * response implying a message went out would be claiming a delivery that never happened.
 */
export async function createRenterForMotel(
  motelId: string,
  managerId: string,
  input: CreateRenterInput,
): Promise<RenterResponse> {
  await resolveOwnedMotel(motelId, managerId);
  if (input.roomId !== undefined && input.roomId !== null) {
    await resolveRoomInMotel(input.roomId, motelId);
  }

  try {
    const row = await createRenter({
      motelId,
      name: input.name,
      phone: input.phone,
      idNumber: input.idNumber,
      idCardFrontUrl: input.idCardFrontUrl,
      idCardBackUrl: input.idCardBackUrl,
      // `roomId: null` on a create is the same request as leaving it out — the column is simply
      // nullable — so it is dropped here rather than passed on as a `null` the parameter does not
      // accept.
      ...(input.roomId === undefined || input.roomId === null ? {} : { roomId: input.roomId }),
    });
    return toResponse(row);
  } catch (error) {
    if (isDuplicatePhone(error)) {
      const stored = normalisePhone(input.phone);
      throw AppError.conflict(`Số điện thoại "${stored}" đã tồn tại trong nhà trọ này`);
    }
    throw error;
  }
}

/**
 * The renter as the manager's screen shows it: the row, the live contract, and the recent bills.
 *
 * The two summaries are asked of the modules that own them rather than read from their tables
 * (ADR-0004). Composed here rather than in the route so the shape is the service's promise and the
 * handler stays an adapter.
 */
export async function getRenterById(
  renterId: string,
  motelId: string,
  managerId: string,
): Promise<RenterDetailResponse> {
  const row = await resolveOwnedRenter(renterId, motelId, managerId);

  // Sequentially, not `Promise.all`. Two queries in flight make postgres.js open a second pooled
  // connection, and `resetDb()` recreates the `public` schema under a new OID — so that second
  // connection's cached plans are invalidated and its next borrower dies with "referenced schema
  // was concurrently dropped". One connection in flight at a time is what every other service
  // here does, and it is what keeps the suite runnable.
  const activeContract = await getActiveContractForRenter(row.id);
  const invoices = await listRecentInvoicesForRenter(row.id, RECENT_INVOICE_LIMIT);

  return { ...toResponse(row), activeContract, invoices };
}

/**
 * A true partial update: a key absent from the body is absent from the patch, so an `undefined`
 * can never overwrite a stored value. An explicit `roomId: null` or `idNumber: null` is the only
 * way to clear those.
 *
 * The phone is normalised here, before the write, so the `renters_phone_normalised` CHECK can
 * never fire — a malformed number is a 400 the manager can read, not a 500 from the constraint.
 */
export async function updateRenter(
  renterId: string,
  motelId: string,
  managerId: string,
  input: UpdateRenterInput,
): Promise<RenterResponse> {
  const owned = await resolveOwnedRenter(renterId, motelId, managerId);

  // Ownership first, then the room: a caller who may not read the renter learns nothing about
  // which rooms exist, in this motel or any other.
  if (input.roomId !== undefined && input.roomId !== null) {
    await resolveRoomInMotel(input.roomId, motelId);
  }

  const patch: RenterPatch = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.phone !== undefined) patch.phone = normalisePhone(input.phone);
  if (input.idNumber !== undefined) patch.idNumber = input.idNumber;
  if (input.idCardFrontUrl !== undefined) patch.idCardFrontUrl = input.idCardFrontUrl;
  if (input.idCardBackUrl !== undefined) patch.idCardBackUrl = input.idCardBackUrl;
  if (input.roomId !== undefined) patch.roomId = input.roomId;
  if (input.status !== undefined) patch.status = input.status;

  // `update ... set` with no columns is a syntax error, and `{}` is a legal request.
  if (Object.keys(patch).length === 0) return toResponse(owned);

  try {
    const [row] = await db.update(renters).set(patch).where(eq(renters.id, renterId)).returning();
    return toResponse(row!);
  } catch (error) {
    // Re-saving a renter's own phone is not a violation: the index compares distinct rows, so
    // PostgreSQL lets it through and only a genuinely taken phone reaches here.
    if (isDuplicatePhone(error)) {
      throw AppError.conflict(`Số điện thoại "${patch.phone}" đã tồn tại trong nhà trọ này`);
    }
    throw error;
  }
}

/**
 * Removing a renter is a status change, never a delete.
 *
 * Everything that makes up a person's tenancy history — contracts, invoices, meter readings, the
 * tickets they filed — hangs off this row and is owed to them long after they leave. Deleting it
 * would either destroy that or fail on the first foreign key it met, and neither is what the
 * manager asked for.
 *
 * Setting `status = 'inactive'` twice is not an error: an absent renter and an already-absent
 * renter are the same state, and refusing the second request would only make the UI worse.
 */
export async function deleteRenter(
  renterId: string,
  motelId: string,
  managerId: string,
): Promise<void> {
  await resolveOwnedRenter(renterId, motelId, managerId);

  await db.update(renters).set({ status: "inactive" }).where(eq(renters.id, renterId));
}