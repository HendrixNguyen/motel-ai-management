import { afterEach, describe, expect, it, vi } from "vitest";
import { createMotelDraft, createMotelFormSession, prepareMotelInput, submitMotel } from "@/lib/motel-form";
import { MOTEL } from "@/lib/api/__tests__/fixtures";

afterEach(() => vi.unstubAllGlobals());

const validDraft = () => ({ ...createMotelDraft(), name: "  Nhà trọ An Bình  ", address: "  8 Nguyễn Trãi  ", electricityPrice: "3.500", waterPrice: "025000" });

describe("motel form transformations", () => {
  it("starts a create form without fabricated prices or bank details", () => {
    expect(createMotelDraft()).toEqual({ name: "", address: "", electricityPrice: "", waterPrice: "", otherFees: [], bankEnabled: false, bankAccount: { bankCode: "", accountNumber: "", accountName: "" } });
  });
  it("prefills an edit with grouped money and preserves leading zeros in account numbers", () => {
    expect(createMotelDraft(MOTEL)).toEqual({ name: MOTEL.name, address: MOTEL.address, electricityPrice: "3.500", waterPrice: "15.000", otherFees: [{ name: "Vệ sinh chung", amount: "50.000" }, { name: "Gửi xe", amount: "100.000" }], bankEnabled: true, bankAccount: MOTEL.bankAccount });
  });
  it("normalizes grouped prices to digit strings and trims text on create", () => {
    expect(prepareMotelInput(validDraft())).toEqual({ ok: true, input: { name: "Nhà trọ An Bình", address: "8 Nguyễn Trãi", electricityPrice: "3500", waterPrice: "25000" } });
  });
  it("clears an empty address explicitly rather than sending undefined", () => {
    expect(prepareMotelInput({ ...validDraft(), address: " " })).toEqual({ ok: true, input: { name: "Nhà trọ An Bình", address: null, electricityPrice: "3500", waterPrice: "25000" } });
  });
  it("only patches changed keys and ignores a formatting-only price change", () => {
    expect(prepareMotelInput({ ...createMotelDraft(MOTEL), name: "Nhà trọ mới", electricityPrice: "003500" }, MOTEL)).toEqual({ ok: true, input: { name: "Nhà trọ mới" } });
  });
  it("does not patch unchanged settings when JSON object keys arrive in a different order", () => {
    const motel = { ...MOTEL, otherFees: MOTEL.otherFees.map(({ name, amount }) => ({ amount, name })), bankAccount: { accountName: "NGUYEN VAN MINH", bankCode: "970436", accountNumber: "0123456789" } };
    expect(prepareMotelInput(createMotelDraft(motel), motel)).toEqual({ ok: true, input: {} });
  });
  it("sends explicit null and an empty list when existing settings are removed", () => {
    expect(prepareMotelInput({ ...createMotelDraft(MOTEL), address: " ", otherFees: [], bankEnabled: false }, MOTEL)).toEqual({ ok: true, input: { address: null, otherFees: [], bankAccount: null } });
  });
  it("normalizes edited fees and bank text while keeping account numbers as strings", () => {
    expect(prepareMotelInput({ ...createMotelDraft(MOTEL), otherFees: [{ name: "  Internet  ", amount: "00.050.000" }], bankAccount: { bankCode: " 970422 ", accountNumber: " 00001234 ", accountName: " NGUYEN AN " } }, MOTEL)).toEqual({ ok: true, input: { otherFees: [{ name: "Internet", amount: "50000" }], bankAccount: { bankCode: "970422", accountNumber: "00001234", accountName: "NGUYEN AN" } } });
  });
});

describe("local motel validation", () => {
  it("reports missing required fields next to their controls", () => {
    expect(prepareMotelInput(createMotelDraft())).toEqual({ ok: false, fields: { name: "Nhập tên nhà trọ", electricityPrice: "Nhập số tiền VND hợp lệ, ví dụ 3.500", waterPrice: "Nhập số tiền VND hợp lệ, ví dụ 3.500" } });
  });
  it.each(["1.500.00", "1.5", "-1", "3500₫", "3,500"])("rejects ambiguous price %s instead of changing its amount", (electricityPrice) => {
    expect(prepareMotelInput({ ...validDraft(), electricityPrice })).toMatchObject({ ok: false, fields: { electricityPrice: expect.any(String) } });
  });
  it("accepts zero and the storage maximum without float conversion", () => {
    expect(prepareMotelInput({ ...validDraft(), electricityPrice: "0", waterPrice: "99.999.999.999.999" })).toMatchObject({ ok: true, input: { electricityPrice: "0", waterPrice: "99999999999999" } });
  });
  it("rejects amounts above numeric(14,0) at the affected field", () => {
    expect(prepareMotelInput({ ...validDraft(), waterPrice: "100000000000000" })).toMatchObject({ ok: false, fields: { waterPrice: "Số tiền tối đa là 99.999.999.999.999 ₫" } });
  });
  it("identifies missing fee fields and incomplete bank details on edit", () => {
    expect(prepareMotelInput({ ...createMotelDraft(MOTEL), otherFees: [{ name: " ", amount: "bad" }], bankAccount: { bankCode: "", accountNumber: "", accountName: "" } }, MOTEL)).toEqual({ ok: false, fields: { "otherFees.0.name": "Nhập tên phí", "otherFees.0.amount": "Nhập số tiền VND hợp lệ, ví dụ 3.500", "bankAccount.bankCode": "Nhập mã ngân hàng", "bankAccount.accountNumber": "Nhập số tài khoản", "bankAccount.accountName": "Nhập tên chủ tài khoản" } });
  });
  it("does not validate hidden bank fields when the bank account is disabled", () => {
    expect(prepareMotelInput({ ...createMotelDraft(MOTEL), bankEnabled: false, bankAccount: { bankCode: "", accountNumber: "", accountName: "" } }, MOTEL)).toEqual({ ok: true, input: { bankAccount: null } });
  });
});

describe("motel submission", () => {
  it("keeps a reopened form's baseline when a dismissed pending save refreshes the motel", async () => {
    const currentMotel = structuredClone(MOTEL);
    const patches: unknown[] = [];
    let release!: () => void;
    const firstSaveReady = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (_path: string, options: RequestInit) => {
      patches.push(JSON.parse(String(options.body)));
      if (patches.length === 1) {
        await firstSaveReady;
        currentMotel.name = "Nhà trọ A";
      } else currentMotel.waterPrice = "25000";
      return Response.json(currentMotel);
    }));

    const first = createMotelFormSession(currentMotel);
    const pending = first.submit({ ...first.initialDraft, name: "Nhà trọ A" });
    // Dismiss and reopen while the first response is pending: the reopened form still shows X.
    const reopened = createMotelFormSession(currentMotel);
    expect(reopened.initialDraft.name).toBe(MOTEL.name);
    release();
    expect(await pending).toEqual({ ok: true, motel: { ...MOTEL, name: "Nhà trọ A" } });
    expect(currentMotel.name).toBe("Nhà trọ A");
    expect(await reopened.submit({ ...reopened.initialDraft, waterPrice: "25.000" })).toMatchObject({ ok: true, motel: { name: "Nhà trọ A", waterPrice: "25000" } });
    expect(patches).toEqual([{ name: "Nhà trọ A" }, { waterPrice: "25000" }]);
  });
  it("blocks invalid drafts before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await submitMotel(createMotelDraft())).toMatchObject({ ok: false, fields: { name: expect.any(String) } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("creates through the same-origin proxy with normalized string prices", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(MOTEL, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await submitMotel(validDraft())).toEqual({ ok: true, motel: MOTEL });
    expect(fetchMock).toHaveBeenCalledWith("/api/manager/motels", expect.objectContaining({ method: "POST", credentials: "same-origin", body: '{"name":"Nhà trọ An Bình","address":"8 Nguyễn Trãi","electricityPrice":"3500","waterPrice":"25000"}' }));
  });
  it("patches only the edited motel and settings the manager changed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(MOTEL));
    vi.stubGlobal("fetch", fetchMock);
    expect(await submitMotel({ ...createMotelDraft(MOTEL), otherFees: [] }, MOTEL)).toEqual({ ok: true, motel: MOTEL });
    expect(fetchMock).toHaveBeenCalledWith(`/api/manager/motels/${MOTEL.id}`, expect.objectContaining({ method: "PATCH", body: '{"otherFees":[]}' }));
  });
  it.each([[409, "CONFLICT"], [404, "NOT_FOUND"], [400, "VALIDATION_ERROR"], [401, "UNAUTHORIZED"]])("keeps HTTP %s at form level without inventing field errors", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Không thể lưu nhà trọ", code }, { status: Number(status) })));
    expect(await submitMotel(validDraft())).toEqual({ ok: false, error: "Không thể lưu nhà trọ", status });
  });
  it("uses a safe message for network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private backend location")));
    expect(await submitMotel(validDraft())).toEqual({ ok: false, error: "Đã xảy ra lỗi hệ thống", status: 0 });
  });
});
