// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import MotelEditor from "@/components/manager/motel-editor";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  notify: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));
vi.mock("@/lib/motel-form", async () => {
  const actual = await vi.importActual<typeof import("@/lib/motel-form")>("@/lib/motel-form");
  return {
    ...actual,
    createMotelFormSession: (motel?: unknown) => ({
      initialDraft: actual.createMotelDraft(motel as never),
      submit: mocks.submit,
    }),
  };
});
vi.mock("@/components/ui/toast", () => ({ useToast: () => mocks.notify }));
vi.mock("@/components/manager/motel-setup-wizard", () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    if (!open) return null;
    return (
      <div role="dialog">
        <p>MotelSetupWizard</p>
        <button
          type="button"
          onClick={() => {
            mocks.submit();
            mocks.notify({ message: "Đã tạo nhà trọ" });
            onClose();
          }}
        >
          Hoàn tất thiết lập
        </button>
      </div>
    );
  },
}));

const motel = {
  id: "m1",
  managerId: "mgr",
  name: "Nhà A",
  address: null,
  electricityPrice: "3500",
  waterPrice: "25000",
  otherFees: [{ name: "Wifi", amount: "50000" }],
  bankAccount: { bankCode: "970436", accountNumber: "123456", accountName: "NGUYEN VAN A" },
  createdAt: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MotelEditor workflow coverage", () => {
  beforeEach(() => {
    mocks.submit.mockReset();
  });

  test("empty state opens create wizard and delegates creation", async () => {
    const view = render(<MotelEditor empty />);
    fireEvent.click(view.getByRole("button", { name: "Tạo nhà trọ" }));
    expect(view.getByText("MotelSetupWizard")).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Hoàn tất thiết lập" }));
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
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith({ message: "Đã lưu thay đổi nhà trọ" }),
    );
  });

  test.each([
    [{ ok: false, status: 401, error: "Unauthorized" }, "redirect"],
    [{ ok: false, status: 404, error: "Không tìm thấy" }, "reload"],
    [
      { ok: false, status: 422, error: "Sai dữ liệu", fields: { name: "Tên không hợp lệ" } },
      "fields",
    ],
  ])("handles submit failure branch %#", async (result, branch) => {
    mocks.submit.mockResolvedValue(result);
    const view = render(<MotelEditor motel={motel as never} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nhà A" }));
    const dialog = view.getByRole("dialog");
    fireEvent.submit(within(dialog).getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    if (branch === "redirect")
      await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
    if (branch === "reload")
      expect(await view.findByRole("button", { name: "Tải lại danh sách" })).toBeInTheDocument();
    if (branch === "fields") expect(await view.findByText("Tên không hợp lệ")).toBeInTheDocument();
  });

  test("recovers from a rejected save without leaking details or locking the form", async () => {
    mocks.submit.mockRejectedValueOnce(new Error("private database.internal"));
    const view = render(<MotelEditor motel={motel as never} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nhà A" }));
    const dialog = view.getByRole("dialog");
    fireEvent.submit(within(dialog).getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    expect(await view.findByRole("alert")).toHaveTextContent(
      "Không thể lưu nhà trọ. Vui lòng thử lại.",
    );
    expect(view.container.textContent).not.toContain("database.internal");
    mocks.submit.mockResolvedValueOnce({
      ok: false,
      status: 409,
      error: "Nhà trọ đang được sử dụng",
    });
    fireEvent.submit(within(dialog).getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
  });

  test("retains motel edit draft after conflict", async () => {
    mocks.submit.mockResolvedValue({ ok: false, status: 409, error: "Nhà trọ đang được sử dụng" });
    const view = render(<MotelEditor motel={motel as never} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nhà A" }));
    const dialog = view.getByRole("dialog");
    const input = within(dialog).getByLabelText("Tên nhà trọ") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "Bản nháp giữ lại" } });
    });
    expect(within(dialog).getByLabelText("Tên nhà trọ")).toHaveValue("Bản nháp giữ lại");
    expect(input.value).toBe("Bản nháp giữ lại");
    await act(async () => {
      fireEvent.submit(
        within(dialog).getByRole("button", { name: "Lưu thay đổi" }).closest("form")!,
      );
    });
    expect(mocks.submit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Bản nháp giữ lại" }),
    );
    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toHaveTextContent("Nhà trọ đang được sử dụng");
      expect(within(dialog).getByLabelText("Tên nhà trọ")).toHaveValue("Bản nháp giữ lại");
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Đóng" }));
  });

  test("limits additional fee rows and returns to no-fee state", async () => {
    const view = render(<MotelEditor motel={motel as never} />);
    fireEvent.click(view.getByRole("button", { name: "Chỉnh sửa Nhà A" }));
    const dialog = view.getByRole("dialog");
    for (let i = 1; i < 6; i++)
      fireEvent.click(within(dialog).getByRole("button", { name: "Thêm phí" }));
    expect(within(dialog).getAllByLabelText(/Tên phí/)).toHaveLength(6);
    expect(within(dialog).getByRole("button", { name: "Thêm phí" })).toBeInTheDocument();
    for (let i = 0; i < 6; i++)
      fireEvent.click(within(dialog).getAllByRole("button", { name: /Xóa phí/ })[0]!);
    expect(within(dialog).getByText("Chưa có phí khác")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Thêm phí" })).toBeInTheDocument();
  });
});
