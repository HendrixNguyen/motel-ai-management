// @vitest-environment jsdom
import { act, fireEvent, render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import type { RenterResponse, RoomResponse } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  submit: vi.fn(),
  notify: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  onChange: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));
vi.mock("@/lib/api/renters.client", () => ({ uploadRenterCccd: mocks.upload }));
vi.mock("@/lib/renter-form", async () => {
  const actual = await vi.importActual<typeof import("@/lib/renter-form")>("@/lib/renter-form");
  return {
    ...actual,
    createRenterFormSession: (motelId: string, renter?: RenterResponse) => ({
      initialDraft: actual.createRenterDraft(renter),
      submit: (draft: Parameters<typeof actual.createRenterDraft>[0]) =>
        mocks.submit(motelId, draft, renter),
    }),
  };
});
vi.mock("@/components/ui/toast", () => ({ useToast: () => mocks.notify }));
import RenterEditor from "@/components/manager/renter-editor";
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const rooms: RoomResponse[] = [
  {
    id: "room-1",
    motelId: "m",
    name: "101",
    floor: 1,
    basePrice: "3500000",
    status: "available",
    createdAt: "2026-01-01T00:00:00Z",
  },
];
const renter: RenterResponse = {
  id: "r",
  motelId: "m",
  name: "Nguyễn A",
  phone: "84901234567",
  idNumber: null,
  idCardFrontUploaded: false,
  idCardBackUploaded: false,
  roomId: null,
  zaloOaId: null,
  isOaFollower: false,
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("RenterEditor branches", () => {
  test("cancel closes create dialog and restores focus to trigger", async () => {
    const view = render(<RenterEditor motelId="m" rooms={rooms} />);
    expect(view.queryByLabelText("Ảnh CCCD")).toBeNull();
    const trigger = view.getByRole("button", { name: "Thêm khách thuê" });
    fireEvent.click(trigger);
    expect(view.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Hủy" }));
    expect(view.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  test("rejected renter save shows safe error, unlocks form and permits retry", async () => {
    const view = render(<RenterEditor motelId="m" rooms={rooms} renter={renter} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nguyễn A" }));
    await view.findByRole("dialog");
    await view.findByRole("dialog");
    const submit = view.getByRole("button", { name: "Lưu thay đổi" });
    mocks.submit.mockRejectedValueOnce(new Error("postgres://internal/private"));
    fireEvent.click(submit);
    expect(await view.findByRole("alert")).toHaveTextContent("Đã xảy ra lỗi hệ thống");
    expect(view.queryByText(/postgres|internal|private/)).toBeNull();
    expect(view.getByLabelText("Họ tên")).toBeEnabled();
    expect(submit).toBeEnabled();
    mocks.submit.mockResolvedValueOnce({ ok: true });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith({ message: "Đã lưu thay đổi khách thuê" }),
    );
    expect(mocks.submit).toHaveBeenCalledTimes(2);
  });

  test("edit handles success, unauthorized, server error and field validation", async () => {
    const view = render(<RenterEditor motelId="m" rooms={rooms} renter={renter} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nguyễn A" }));
    await view.findByRole("dialog");
    mocks.submit.mockResolvedValueOnce({ ok: true });
    fireEvent.submit(view.getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith({ message: "Đã lưu thay đổi khách thuê" }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  test("maps 401 to login redirect and 404 to reload action", async () => {
    const view = render(<RenterEditor motelId="m" rooms={rooms} renter={renter} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nguyễn A" }));
    await view.findByRole("dialog");
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
    const view = render(
      <RenterEditor motelId="m" rooms={[]} renter={{ ...renter, roomId: "deleted-room" }} />,
    );
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nguyễn A" }));
    fireEvent.click(view.getByRole("combobox", { name: "Phòng (không bắt buộc)" }));
    expect(view.getByRole("option", { name: "Phòng chưa cập nhật" })).toBeInTheDocument();
    fireEvent.click(view.getByRole("option", { name: "Phòng chưa cập nhật" }));
    mocks.submit.mockResolvedValueOnce({
      ok: false,
      status: 422,
      error: "Sai thông tin",
      fields: { phone: "Số điện thoại chưa đúng" },
    });
    fireEvent.submit(view.getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    expect(await view.findByText("Số điện thoại chưa đúng")).toBeInTheDocument();
  });

  test("retains renter edit draft after conflict", async () => {
    const view = render(<RenterEditor motelId="m" rooms={rooms} renter={renter} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nguyễn A" }));
    await view.findByRole("dialog");
    const input = view.getByLabelText("Họ tên") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Bản nháp" } });
    expect(view.getByLabelText("Họ tên")).toHaveValue("Bản nháp");
    fireEvent.click(view.getByRole("combobox", { name: "Trạng thái thuê" }));
    fireEvent.click(view.getByRole("option", { name: "Đã kết thúc hợp đồng" }));
    mocks.submit.mockResolvedValueOnce({ ok: false, status: 409, error: "Thông tin vừa thay đổi" });
    await act(async () => {
      fireEvent.submit(view.getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    });
    await waitFor(() =>
      expect(mocks.submit).toHaveBeenCalledWith(
        "m",
        expect.objectContaining({ name: "Bản nháp", status: "inactive" }),
        renter,
      ),
    );
    await waitFor(() => {
      expect(view.getByRole("alert")).toHaveTextContent("Thông tin vừa thay đổi");
      expect(view.getByLabelText("Họ tên")).toHaveValue("Bản nháp");
    });
    expect(view.getByRole("dialog")).toBeInTheDocument();
  });

  test("redacts unexpected CCCD upload failures but preserves safe API validation errors", async () => {
    const view = render(<RenterEditor motelId="m" rooms={rooms} renter={renter} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nguyễn A" }));
    await view.findByRole("dialog");
    mocks.upload.mockRejectedValueOnce(new Error("https://r2.internal/private-key"));
    fireEvent.change(view.getByLabelText(/CCCD mặt trước/), {
      target: { files: [new File(["x"], "front.jpg", { type: "image/jpeg" })] },
    });
    expect(await view.findByRole("alert")).toHaveTextContent(
      "Không thể tải ảnh CCCD. Vui lòng thử lại.",
    );
    expect(view.queryByText(/r2\.internal|private-key/)).toBeNull();
    mocks.upload.mockRejectedValueOnce(
      new ApiError(400, "VALIDATION_ERROR", "Chỉ chấp nhận JPEG hoặc PNG"),
    );
    fireEvent.change(view.getByLabelText(/CCCD mặt sau/), {
      target: { files: [new File(["x"], "back.jpg", { type: "image/jpeg" })] },
    });
    expect(await view.findByRole("alert")).toHaveTextContent("Chỉ chấp nhận JPEG hoặc PNG");
  });

  test("CCCD upload success/failure branches update only manager edit form", async () => {
    const view = render(<RenterEditor motelId="m" rooms={rooms} renter={renter} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nguyễn A" }));
    await view.findByRole("dialog");
    mocks.upload.mockResolvedValueOnce({ uploaded: true });
    const input = view.getByLabelText(/CCCD mặt trước/);
    fireEvent.change(input, {
      target: { files: [new File(["image"], "front.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(view.getByText(/CCCD mặt trước · đã tải/)).toBeInTheDocument());
    mocks.upload.mockRejectedValueOnce(new Error("R2 unavailable"));
    fireEvent.change(view.getByLabelText(/CCCD mặt sau/), {
      target: { files: [new File(["image"], "back.jpg", { type: "image/jpeg" })] },
    });
    expect(await view.findByRole("alert")).toHaveTextContent(
      "Không thể tải ảnh CCCD. Vui lòng thử lại.",
    );
  });
});
