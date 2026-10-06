import type { CreateRoomInput, RoomResponse, RoomStatus, UpdateRoomInput } from "@/lib/api/types";
import { ApiError, GENERIC_ERROR_MESSAGE } from "@/lib/api/client";
import { createRoom, updateRoom } from "@/lib/api/rooms.client";
import { formatVndPlain, parseVndDigits } from "@/lib/format/vnd";
import { parseRoomFloor } from "@/lib/room-query";

export type RoomDraft = { name: string; floor: string; basePrice: string };
export type RoomFieldErrors = Record<string, string>;
export type RoomSubmitResult = { ok: true } | { ok: false; fields?: RoomFieldErrors; error?: string; status?: number };
type PreparedRoom<T> = { ok: true; input: T } | { ok: false; fields: RoomFieldErrors };

export function createRoomDraft(room?: RoomResponse): RoomDraft {
  return { name: room?.name ?? "", floor: room?.floor == null ? "" : String(room.floor), basePrice: room ? formatVndPlain(room.basePrice) : "" };
}

export function prepareRoomInput(draft: RoomDraft): PreparedRoom<CreateRoomInput>;
export function prepareRoomInput(draft: RoomDraft, room: RoomResponse): PreparedRoom<UpdateRoomInput>;
export function prepareRoomInput(draft: RoomDraft, room?: RoomResponse): PreparedRoom<CreateRoomInput | UpdateRoomInput> {
  const fields: RoomFieldErrors = {};
  const name = draft.name.trim();
  if (!name) fields.name = "Nhập tên phòng";
  const basePrice = parseVndDigits(draft.basePrice);
  if (basePrice === null) fields.basePrice = "Nhập số tiền VND hợp lệ, ví dụ 3.500.000";
  else if (basePrice.length > 14) fields.basePrice = "Số tiền tối đa là 99.999.999.999.999 ₫";
  const floor = draft.floor.trim() === "" ? null : parseRoomFloor(draft.floor);
  if (floor === undefined) fields.floor = "Nhập tầng bằng số nguyên từ -2.147.483.648 đến 2.147.483.647";
  if (Object.keys(fields).length) return { ok: false, fields };
  const input: CreateRoomInput = { name, basePrice: basePrice!, floor };
  if (!room) return { ok: true, input };
  const patch: UpdateRoomInput = {};
  if (name !== room.name) patch.name = name;
  if (basePrice !== room.basePrice) patch.basePrice = input.basePrice;
  if (floor !== room.floor) patch.floor = floor;
  return { ok: true, input: patch };
}

function failure(error: unknown): RoomSubmitResult {
  return error instanceof ApiError
    ? { ok: false, error: error.message, status: error.status }
    : { ok: false, error: GENERIC_ERROR_MESSAGE };
}

export async function submitRoom(motelId: string, draft: RoomDraft, room?: RoomResponse): Promise<RoomSubmitResult> {
  try {
    if (room) {
      const prepared = prepareRoomInput(draft, room);
      if (!prepared.ok) return prepared;
      await updateRoom(motelId, room.id, prepared.input);
    } else {
      const prepared = prepareRoomInput(draft);
      if (!prepared.ok) return prepared;
      await createRoom(motelId, prepared.input);
    }
    return { ok: true };
  } catch (error) { return failure(error); }
}

/** This action patches status alone; it never rewrites the room or renter assignment. */
export async function submitRoomStatus(motelId: string, roomId: string, status: RoomStatus): Promise<RoomSubmitResult> {
  try { await updateRoom(motelId, roomId, { status }); return { ok: true }; }
  catch (error) { return failure(error); }
}

/** Draft and PATCH baseline belong to the opened form, independent of later RSC props. */
export function createRoomFormSession(motelId: string, room?: RoomResponse) {
  const original = room ? structuredClone(room) : undefined;
  return { initialDraft: createRoomDraft(original), submit: (draft: RoomDraft) => submitRoom(motelId, draft, original) };
}
