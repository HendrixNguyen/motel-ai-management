import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoomDraft, createRoomFormSession, prepareRoomInput, submitRoom, submitRoomStatus } from "@/lib/room-form";
import { MOTEL, ROOM, ROOM_WITHOUT_FLOOR } from "@/lib/api/__tests__/fixtures";

afterEach(() => vi.unstubAllGlobals());
const valid = () => ({ name: " P.102 ", floor: "0", basePrice: "003500000" });

describe("room create/edit input", () => {
  it("prefills editable prices as plain grouped VND and leaves nullable floor blank", () => {
    expect(createRoomDraft()).toEqual({ name: "", floor: "", basePrice: "" });
    expect(createRoomDraft(ROOM)).toEqual({ name: "P.101", floor: "1", basePrice: "3.500.000" });
    expect(createRoomDraft(ROOM_WITHOUT_FLOOR).floor).toBe("");
  });
  it("creates exact digit-string rent and floor zero with no amenities or fabricated status", () => {
    expect(prepareRoomInput(valid())).toEqual({ ok: true, input: { name: "P.102", floor: 0, basePrice: "3500000" } });
    expect(prepareRoomInput({ ...valid(), floor: "" })).toMatchObject({ ok: true, input: { floor: null } });
  });
  it("only patches changed fields, explicitly clears floor, and ignores formatting-only prices", () => {
    expect(prepareRoomInput({ ...createRoomDraft(ROOM), basePrice: "003500000" }, ROOM)).toEqual({ ok: true, input: {} });
    expect(prepareRoomInput({ ...createRoomDraft(ROOM), name: "P.201", floor: "" }, ROOM)).toEqual({ ok: true, input: { name: "P.201", floor: null } });
  });
  it("reports local required errors without touching the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await submitRoom(MOTEL.id, createRoomDraft())).toEqual({ ok: false, fields: { name: "Nhập tên phòng", basePrice: "Nhập số tiền VND hợp lệ, ví dụ 3.500.000" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["1.5", "1e2", "2147483648", "-2147483649", "abc"])("rejects floor %s against the floor field", (floor) => {
    expect(prepareRoomInput({ ...valid(), floor })).toMatchObject({ ok: false, fields: { floor: expect.any(String) } });
  });
  it.each(["-1", "1.5", "1.500.00", "3,500", "100000000000000"])("rejects rent %s without changing its amount", (basePrice) => {
    expect(prepareRoomInput({ ...valid(), basePrice })).toMatchObject({ ok: false, fields: { basePrice: expect.any(String) } });
  });
  it("accepts zero rent, the numeric maximum and signed int4 floor boundaries", () => {
    expect(prepareRoomInput({ ...valid(), basePrice: "0", floor: "-2147483648" })).toMatchObject({ ok: true, input: { basePrice: "0", floor: -2147483648 } });
    expect(prepareRoomInput({ ...valid(), basePrice: "99.999.999.999.999", floor: "2147483647" })).toMatchObject({ ok: true, input: { basePrice: "99999999999999", floor: 2147483647 } });
  });
});

describe("room actions", () => {
  it("creates through the same-origin proxy and edits only the fields the manager changed", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => Response.json(ROOM));
    vi.stubGlobal("fetch", fetchMock);
    expect(await submitRoom(MOTEL.id, valid())).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/manager/motels/${MOTEL.id}/rooms`, expect.objectContaining({ method: "POST", credentials: "same-origin", body: '{"name":"P.102","basePrice":"3500000","floor":0}' }));
    expect(await submitRoom(MOTEL.id, { ...createRoomDraft(ROOM), floor: "" }, ROOM)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/manager/motels/${MOTEL.id}/rooms/${ROOM.id}`, expect.objectContaining({ method: "PATCH", body: '{"floor":null}' }));
  });
  it("preserves an opened form baseline when an older pending edit refreshes the room", async () => {
    const current = structuredClone(ROOM);
    const patches: unknown[] = [];
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (_path: string, options: RequestInit) => {
      patches.push(JSON.parse(String(options.body)));
      if (patches.length === 1) { await ready; current.name = "P.201"; }
      return Response.json(current);
    }));
    const first = createRoomFormSession(MOTEL.id, current);
    const pending = first.submit({ ...first.initialDraft, name: "P.201" });
    const reopened = createRoomFormSession(MOTEL.id, current);
    release();
    expect(await pending).toEqual({ ok: true });
    expect(await reopened.submit({ ...reopened.initialDraft, basePrice: "4.000.000" })).toEqual({ ok: true });
    expect(patches).toEqual([{ name: "P.201" }, { basePrice: "4000000" }]);
  });
  it("changes only status, never name, floor, price or renter assignment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ...ROOM, status: "maintenance" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await submitRoomStatus(MOTEL.id, ROOM.id, "maintenance")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(`/api/manager/motels/${MOTEL.id}/rooms/${ROOM.id}`, expect.objectContaining({ method: "PATCH", body: '{"status":"maintenance"}' }));
  });
  it.each([[409, "CONFLICT"], [400, "VALIDATION_ERROR"], [404, "NOT_FOUND"], [401, "UNAUTHORIZED"]] as const)("renders HTTP %s at form level and retains status for recovery", async (status, code) => {
    const error = 'Phòng "P.102" đã tồn tại trong nhà trọ này';
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ error, code }, { status })));
    expect(await submitRoom(MOTEL.id, valid())).toEqual({ ok: false, error, status });
    expect(await submitRoomStatus(MOTEL.id, ROOM.id, "available")).toEqual({ ok: false, error, status });
  });
  it("uses a safe form error on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private backend location")));
    expect(await submitRoom(MOTEL.id, valid())).toEqual({ ok: false, error: "Đã xảy ra lỗi hệ thống", status: 0 });
  });
});
