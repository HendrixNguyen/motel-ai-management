import { afterEach, describe, expect, it, vi } from "vitest";
import { createRenterDraft, createRenterFormSession, prepareRenterInput, submitRenter } from "@/lib/renter-form";
import { MOTEL, ROOM, RENTER } from "@/lib/api/__tests__/fixtures";

afterEach(() => vi.unstubAllGlobals());
const valid = () => ({ name: " Nguyễn Thị An ", phone: "0901234567", idNumber: "", roomId: "" });

describe("renter create/edit", () => {
  it("creates supported fields with normalized phone and nullable optional values", () => {
    expect(prepareRenterInput(valid())).toEqual({ ok: true, input: { name: "Nguyễn Thị An", phone: "84901234567", idNumber: null, roomId: null } });
    expect(prepareRenterInput({ ...valid(), phone: "+84 901 234 567", idNumber: " 00001234 ", roomId: ROOM.id })).toEqual({ ok: true, input: { name: "Nguyễn Thị An", phone: "84901234567", idNumber: "00001234", roomId: ROOM.id } });
  });
  it("only patches changes, preserves unchanged image keys and explicitly unassigns/clears", () => {
    expect(prepareRenterInput({ ...createRenterDraft(RENTER), phone: "+84 901 234 567" }, RENTER)).toEqual({ ok: true, input: {} });
    expect(prepareRenterInput({ ...createRenterDraft(RENTER), idNumber: "", roomId: "" }, RENTER)).toEqual({ ok: true, input: { idNumber: null, roomId: null } });
  });
  it("reports required fields before any mutation", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await submitRenter(MOTEL.id, createRenterDraft())).toEqual({ ok: false, fields: { name: "Nhập họ tên", phone: "Nhập số điện thoại Việt Nam hợp lệ" } });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["1e9", "123", "+1 901234567", "0123456789"])('rejects invalid phone "%s" locally', (phone) => {
    expect(prepareRenterInput({ ...valid(), phone })).toMatchObject({ ok: false, fields: { phone: expect.any(String) } });
  });
  it("creates and edits with relative URLs and exact partial bodies", async () => {
    const fetch = vi.fn(async () => Response.json(RENTER)); vi.stubGlobal("fetch", fetch);
    expect(await submitRenter(MOTEL.id, valid())).toEqual({ ok: true });
    expect(fetch).toHaveBeenLastCalledWith(`/api/manager/motels/${MOTEL.id}/renters`, expect.objectContaining({ method: "POST", credentials: "same-origin", body: '{"name":"Nguyễn Thị An","phone":"84901234567","idNumber":null,"roomId":null}' }));
    expect(await submitRenter(MOTEL.id, { ...createRenterDraft(RENTER), idNumber: "" }, RENTER)).toEqual({ ok: true });
    expect(fetch).toHaveBeenLastCalledWith(`/api/manager/motels/${MOTEL.id}/renters/${RENTER.id}`, expect.objectContaining({ method: "PATCH", body: '{"idNumber":null}' }));
  });
  it("freezes the opened baseline when a dismissed pending save refreshes renter data", async () => {
    const current = structuredClone(RENTER);
    const patches: unknown[] = [];
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (_path: string, options: RequestInit) => {
      patches.push(JSON.parse(String(options.body)));
      if (patches.length === 1) { await ready; current.name = "Tên đã lưu"; }
      return Response.json(current);
    }));
    const first = createRenterFormSession(MOTEL.id, current);
    const pending = first.submit({ ...first.initialDraft, name: "Tên đã lưu" });
    const reopened = createRenterFormSession(MOTEL.id, current);
    release();
    expect(await pending).toEqual({ ok: true });
    expect(await reopened.submit({ ...reopened.initialDraft, idNumber: "" })).toEqual({ ok: true });
    expect(patches).toEqual([{ name: "Tên đã lưu" }, { idNumber: null }]);
  });
  it.each([[400, "VALIDATION_ERROR"], [401, "UNAUTHORIZED"], [404, "NOT_FOUND"], [409, "CONFLICT"]] as const)("keeps HTTP %s errors at form level", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Không thể lưu khách thuê", code }, { status })));
    expect(await submitRenter(MOTEL.id, valid())).toEqual({ ok: false, error: "Không thể lưu khách thuê", status });
  });
  it.each([500, 502])("masks HTTP %s infrastructure details", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "private database address", code: "INTERNAL_ERROR" }, { status })));
    expect(await submitRenter(MOTEL.id, valid())).toEqual({ ok: false, error: "Đã xảy ra lỗi hệ thống", status });
  });
  it("masks network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private location")));
    expect(await submitRenter(MOTEL.id, valid())).toEqual({ ok: false, error: "Đã xảy ra lỗi hệ thống", status: 0 });
  });
});
