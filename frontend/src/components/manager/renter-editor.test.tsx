import { fireEvent, render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { JSDOM } from "jsdom";
import type { RenterResponse, RoomResponse } from "@/lib/api/types";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), submit: vi.fn(), notify: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }) }));
vi.mock("@/lib/api/renters.client", () => ({ uploadRenterCccd: mocks.upload }));
vi.mock("@/lib/renter-form", async () => {
  const actual = await vi.importActual<typeof import("@/lib/renter-form")>("@/lib/renter-form");
  return { ...actual, createRenterFormSession: (motelId: string, renter?: RenterResponse) => ({ initialDraft: actual.createRenterDraft(renter), submit: (draft: Parameters<typeof actual.createRenterDraft>[0]) => mocks.submit(motelId, draft, renter) }) };
});
vi.mock("@/components/ui/toast", () => ({ useToast: () => mocks.notify }));
import RenterEditor from "./renter-editor";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
dom.window.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function() { this.open = false; this.dispatchEvent(new dom.window.Event("close")); };
Object.defineProperties(globalThis, { window: { configurable: true, value: dom.window }, document: { configurable: true, value: dom.window.document }, navigator: { configurable: true, value: dom.window.navigator }, HTMLElement: { configurable: true, value: dom.window.HTMLElement }, Node: { configurable: true, value: dom.window.Node }, Event: { configurable: true, value: dom.window.Event }, MouseEvent: { configurable: true, value: dom.window.MouseEvent }, IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true } });
beforeAll(() => { Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, writable: true, value: true }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const rooms: RoomResponse[] = [{ id: "room-1", motelId: "m", name: "101", floor: 1, basePrice: "3500000", status: "available", createdAt: "2026-01-01T00:00:00Z" }];
const renter: RenterResponse = { id: "r", motelId: "m", name: "Nguyễn A", phone: "84901234567", idNumber: null, idCardFrontUploaded: false, idCardBackUploaded: false, roomId: null, zaloOaId: null, isOaFollower: false, status: "active", createdAt: "2026-01-01T00:00:00Z" };

describe("RenterEditor branches", () => {
  test("renders create without CCCD controls and closes on cancel", () => {
    const view = render(<RenterEditor motelId="m" rooms={rooms} />);
    expect(view.queryByLabelText("Ảnh CCCD")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Thêm khách thuê" }));
    expect(view.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Hủy" }));
    expect(view.queryByRole("dialog")).toBeNull();
  });

  test("edit handles success, unauthorized, server error and field validation", async () => {
    const view = render(<RenterEditor motelId="m" rooms={rooms} renter={renter} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nguyễn A" }));
    mocks.submit.mockResolvedValueOnce({ ok: true });
    fireEvent.submit(view.getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ message: "Đã lưu thay đổi khách thuê" }));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  test("maps 401 to login redirect and 404 to reload action", async () => {
    const view = render(<RenterEditor motelId="m" rooms={rooms} renter={renter} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nguyễn A" }));
    mocks.submit.mockResolvedValueOnce({ ok: false, status: 401, error: "Unauthorized" });
    fireEvent.submit(view.getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
    expect(mocks.refresh).toHaveBeenCalled();
    cleanup();
    mocks.replace.mockClear();
    const second = render(<RenterEditor motelId="m" rooms={rooms} renter={renter} />);
    fireEvent.click(second.getByRole("button", { name: "Chỉnh sửa Nguyễn A" }));
    mocks.submit.mockResolvedValueOnce({ ok: false, status: 404, error: "Not found" });
    fireEvent.submit(second.getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    expect(await second.findByRole("button", { name: "Tải lại danh sách" })).toBeInTheDocument();
  });

  test("renders renter validation summary and preserves stale room option", async () => {
    const view = render(<RenterEditor motelId="m" rooms={[]} renter={{ ...renter, roomId: "deleted-room" }} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nguyễn A" }));
    expect(view.getByRole("option", { name: "Phòng chưa cập nhật" })).toBeInTheDocument();
    mocks.submit.mockResolvedValueOnce({ ok: false, status: 422, error: "Sai thông tin", fields: { phone: "Số điện thoại chưa đúng" } });
    fireEvent.submit(view.getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    expect(await view.findByText("Số điện thoại chưa đúng")).toBeInTheDocument();
  });

  test("CCCD upload success/failure branches update only manager edit form", async () => {
    const view = render(<RenterEditor motelId="m" rooms={rooms} renter={renter} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nguyễn A" }));
    mocks.upload.mockResolvedValueOnce({ uploaded: true });
    const input = view.getByLabelText(/CCCD mặt trước/);
    fireEvent.change(input, { target: { files: [new File(["image"], "front.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(view.getByText(/CCCD mặt trước · đã tải/)).toBeInTheDocument());
    mocks.upload.mockRejectedValueOnce(new Error("R2 unavailable"));
    fireEvent.change(view.getByLabelText(/CCCD mặt sau/), { target: { files: [new File(["image"], "back.jpg", { type: "image/jpeg" })] } });
    expect(await view.findByText("R2 unavailable")).toBeInTheDocument();
  });
});
