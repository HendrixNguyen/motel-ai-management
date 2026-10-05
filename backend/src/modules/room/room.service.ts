import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { resolveOwnedMotel } from "@/middleware/tenancy";
import { hasActiveContractForRoom } from "@/modules/contract/contract.service";
import { countRentersInRoom } from "@/modules/renter/renter.service";
import { AppError } from "@/shared/errors";
import { parseAmount } from "@/shared/money";
import { rooms } from "./room.schema";
import type {
  CreateRoomInput,
  ListRoomsFilters,
  RoomResponse,
  RoomStatus,
  UpdateRoomInput,
} from "./room.types";

export type RoomRow = typeof rooms.$inferSelect;

type RoomPatch = Partial<{
  name: string;
  basePrice: string;
  floor: number | null;
  status: RoomStatus;
}>;

/** The `rooms_motel_id_name_uq` index, named as PostgreSQL names it in a 23505 error. */
const ROOM_NAME_UNIQUE = "rooms_motel_id_name_uq";

/** SQLSTATE for `unique_violation`. */
const UNIQUE_VIOLATION = "23505";

export async function countRoomsForMotel(motelId: string): Promise<number> {
  return db.$count(rooms, eq(rooms.motelId, motelId));
}

export async function countOccupiedRoomsForMotel(motelId: string): Promise<number> {
  return db.$count(rooms, and(eq(rooms.motelId, motelId), eq(rooms.status, "occupied")));
}

/**
 * `\` is PostgreSQL's default escape character inside `LIKE`/`ILIKE`, so escaping it along with
 * `%` and `_` is enough to make the search text match itself. Without this, `?search=100%` — a
 * plausible way to look for a room — matches every room in the motel.
 */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * The unique index is the judge, not a `SELECT` first: two managers creating `P.101` at the same
 * moment would both pass a pre-check and one insert would still lose. Reading PostgreSQL's own
 * refusal is also the only way to catch the violation at all — the route schema cannot know
 * which names already exist.
 */
function isDuplicateRoomName(error: unknown): boolean {
  // Drizzle wraps a driver failure: `DrizzleQueryError.cause` is the `PostgresError` carrying
  // the SQLSTATE and the index name. Both layers are read so the check does not depend on the
  // wrapper being there.
  const driver = (error as { cause?: unknown } | null)?.cause ?? error;
  const { code, constraint_name } = (driver ?? {}) as {
    code?: unknown;
    constraint_name?: unknown;
  };
  return code === UNIQUE_VIOLATION && constraint_name === ROOM_NAME_UNIQUE;
}

/**
 * `createdAt` is a `timestamptz`, and the contract asks for ISO-8601 UTC on the wire. Spelling
 * that out here is what lets `RoomResponse.createdAt` be a `string`: `numeric` handing back a
 * JS number for `basePrice` would fail this function's return type instead of slipping through.
 */
function toResponse(row: RoomRow): RoomResponse {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

/**
 * The room is found by id *and* motel id in the same query. A room id on its own says nothing
 * about the tenant, so looking the row up first and checking ownership afterwards would mean
 * answering questions about another manager's data before deciding the caller may not have it.
 */
async function resolveOwnedRoom(
  roomId: string,
  motelId: string,
  managerId: string,
): Promise<RoomRow> {
  await resolveOwnedMotel(motelId, managerId);

  const row = await db.query.rooms.findFirst({
    where: and(eq(rooms.id, roomId), eq(rooms.motelId, motelId)),
  });
  if (!row) {
    throw AppError.notFound("Không tìm thấy phòng");
  }
  return row;
}

export async function listRooms(
  motelId: string,
  managerId: string,
  filters: ListRoomsFilters = {},
): Promise<RoomResponse[]> {
  await resolveOwnedMotel(motelId, managerId);

  const conditions = [eq(rooms.motelId, motelId)];
  if (filters.floor !== undefined) conditions.push(eq(rooms.floor, filters.floor));
  if (filters.status !== undefined) conditions.push(eq(rooms.status, filters.status));
  // An empty `?search=` is not a filter; treating it as `%` would quietly answer a question the
  // caller did not ask.
  if (filters.search !== undefined && filters.search !== "") {
    conditions.push(ilike(rooms.name, `%${escapeLike(filters.search)}%`));
  }

  const rows = await db.query.rooms.findMany({
    where: and(...conditions),
    orderBy: [asc(rooms.name), asc(rooms.id)],
  });
  return rows.map(toResponse);
}

/**
 * Fields are copied one by one rather than spread, so nothing the client sent beyond the
 * documented body — a `motelId` or `managerId`, for instance — can ever reach the insert.
 */
export async function createRoom(
  motelId: string,
  managerId: string,
  input: CreateRoomInput,
): Promise<RoomResponse> {
  await resolveOwnedMotel(motelId, managerId);

  try {
    const [row] = await db
      .insert(rooms)
      .values({
        motelId,
        name: input.name,
        basePrice: parseAmount(input.basePrice),
        floor: input.floor ?? null,
        status: input.status ?? "available",
      })
      .returning();
    return toResponse(row!);
  } catch (error) {
    if (isDuplicateRoomName(error)) {
      throw AppError.conflict(`Phòng "${input.name}" đã tồn tại trong nhà trọ này`);
    }
    throw error;
  }
}

export async function getRoom(
  roomId: string,
  motelId: string,
  managerId: string,
): Promise<RoomResponse> {
  return toResponse(await resolveOwnedRoom(roomId, motelId, managerId));
}

/**
 * A true partial update: a key absent from the body is absent from the patch, so an `undefined`
 * can never overwrite a stored value. An explicit `floor: null` is the only way to clear it.
 */
export async function updateRoom(
  roomId: string,
  motelId: string,
  managerId: string,
  input: UpdateRoomInput,
): Promise<RoomResponse> {
  const owned = await resolveOwnedRoom(roomId, motelId, managerId);

  const patch: RoomPatch = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.basePrice !== undefined) patch.basePrice = parseAmount(input.basePrice);
  if (input.floor !== undefined) patch.floor = input.floor;
  if (input.status !== undefined) patch.status = input.status;

  // `update ... set` with no columns is a syntax error, and `{}` is a legal request.
  if (Object.keys(patch).length === 0) return toResponse(owned);

  try {
    const [row] = await db.update(rooms).set(patch).where(eq(rooms.id, roomId)).returning();
    return toResponse(row!);
  } catch (error) {
    if (isDuplicateRoomName(error) && input.name !== undefined) {
      throw AppError.conflict(`Phòng "${input.name}" đã tồn tại trong nhà trọ này`);
    }
    throw error;
  }
}

/**
 * Deleting a room is refused while anything still points at it, and the two refusals are worded
 * differently because the manager's next move differs: end the contract, or move the renter.
 *
 * Every foreign key in this schema is `ON DELETE no action`, so a delete that had dependents
 * would raise a constraint violation the error handler reports as a 500 — an internal detail
 * dressed up as a server fault. Nothing is ever cascaded away silently: a signed contract and
 * the person living under it are both history that has to stay.
 *
 * The counts come from the owning modules' services, never from their tables (ADR-0004).
 */
export async function deleteRoom(
  roomId: string,
  motelId: string,
  managerId: string,
): Promise<void> {
  await resolveOwnedRoom(roomId, motelId, managerId);

  if (await hasActiveContractForRoom(roomId)) {
    throw AppError.conflict(
      "Phòng đang có hợp đồng hiệu lực. Hãy kết thúc hợp đồng trước khi xóa phòng.",
    );
  }

  const renters = await countRentersInRoom(roomId);
  if (renters > 0) {
    throw AppError.conflict(
      `Còn ${renters} người thuê trong phòng. Hãy chuyển sang phòng khác trước khi xóa phòng.`,
    );
  }

  await db.delete(rooms).where(eq(rooms.id, roomId));
}