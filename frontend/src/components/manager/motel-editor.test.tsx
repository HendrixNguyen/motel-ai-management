import { fireEvent, render, within, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { JSDOM } from "jsdom";
import MotelEditor from "./motel-editor";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.defineProperties(globalThis, { window: { configurable: true, value: dom.window }, document: { configurable: true, value: dom.window.document }, navigator: { configurable: true, value: dom.window.navigator }, HTMLElement: { configurable: true, value: dom.window.HTMLElement }, Node: { configurable: true, value: dom.window.Node }, Event: { configurable: true, value: dom.window.Event }, CustomEvent: { configurable: true, value: dom.window.CustomEvent }, MouseEvent: { configurable: true, value: dom.window.MouseEvent }, IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true } });
beforeAll(() => { Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true }); });
dom.window.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function() { this.open = false; this.dispatchEvent(new dom.window.Event("close")); };

const mocks = vi.hoisted(() => ({ submit: vi.fn(), notify: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }) }));
vi.mock("@/lib/motel-form", async () => {
  const actual = await vi.importActual<typeof import("@/lib/motel-form")>("@/lib/motel-form");
  return { ...actual, createMotelFormSession: (motel?: unknown) => ({ initialDraft: actual.createMotelDraft(motel as never), submit: mocks.submit }) };
});
vi.mock("@/components/ui/toast", () => ({ useToast: () => mocks.notify }));

const motel = { id: "m1", managerId: "mgr", name: "Nhà A", address: null, electricityPrice: "3500", waterPrice: "25000", otherFees: [{ name: "Wifi", amount: "50000" }], bankAccount: { bankCode: "970436", accountNumber: "123456", accountName: "NGUYEN VAN A" }, createdAt: "2026-01-01T00:00:00.000Z" };

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("MotelEditor workflow coverage", () => {
  beforeEach(() => { mocks.submit.mockReset(); });

  test("empty state opens create, submits, and announces success", async () => {
    mocks.submit.mockResolvedValue({ ok: true, motel: { ...motel, name: "Nhà mới" } });
    const view = render(<MotelEditor empty />);
    fireEvent.click(view.getByRole("button", { name: "Tạo nhà trọ" }));
    fireEvent.change(view.getByLabelText("Tên nhà trọ"), { target: { value: "Nhà mới" } });
    fireEvent.change(view.getByLabelText("Giá điện (₫/kWh)"), { target: { value: "3500" } });
    fireEvent.change(view.getByLabelText("Giá nước (₫/m³)"), { target: { value: "25000" } });
    fireEvent.submit(view.container.querySelector("form")!);
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ message: "Đã tạo nhà trọ" }));
    expect(mocks.submit).toHaveBeenCalled();
  });

  test("edit supports other fee add/remove and disabling bank account", async () => {
    mocks.submit.mockResolvedValue({ ok: true, motel: { ...motel, bankAccount: null } });
    const view = render(<MotelEditor motel={motel as never} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nhà A" }));
    const dialog = view.getByRole("dialog");
    expect(within(dialog).getByDisplayValue("Wifi")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Xóa phí/ }));
    expect(within(dialog).getByText("Chưa có phí khác")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Thêm phí" }));
    expect(within(dialog).getByLabelText("Tên phí 1")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText("Thiết lập tài khoản nhận tiền"));
    expect(within(dialog).queryByLabelText("Mã ngân hàng")).toBeNull();
    fireEvent.submit(within(dialog).getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ message: "Đã lưu thay đổi nhà trọ" }));
  });

  test.each([
    [{ ok: false, status: 401, error: "Unauthorized" }, "redirect"],
    [{ ok: false, status: 404, error: "Không tìm thấy" }, "reload"],
    [{ ok: false, status: 422, error: "Sai dữ liệu", fields: { name: "Tên không hợp lệ" } }, "fields"],
  ])("handles submit failure branch %#", async (result, branch) => {
    mocks.submit.mockResolvedValue(result);
    const view = render(<MotelEditor motel={motel as never} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nhà A" }));
    const dialog = view.getByRole("dialog");
    fireEvent.submit(within(dialog).getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    if (branch === "redirect") await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
    if (branch === "reload") expect(await view.findByRole("button", { name: "Tải lại danh sách" })).toBeInTheDocument();
    if (branch === "fields")     expect(await view.findByText("Tên không hợp lệ")).toBeInTheDocument();
  });

  test("limits additional fee rows and returns to no-fee state", async () => {
    const view = render(<MotelEditor motel={motel as never} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nhà A" }));
    const dialog = view.getByRole("dialog");
    for (let i = 1; i < 6; i++) fireEvent.click(within(dialog).getByRole("button", { name: "Thêm phí" }));
    expect(within(dialog).getAllByLabelText(/Tên phí/)).toHaveLength(6);
    expect(within(dialog).getByRole("button", { name: "Thêm phí" })).toBeInTheDocument();
    for (let i = 0; i < 6; i++) fireEvent.click(within(dialog).getAllByRole("button", { name: /Xóa phí/ })[0]!);
    expect(within(dialog).getByText("Chưa có phí khác")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Thêm phí" })).toBeInTheDocument();
  });
});
