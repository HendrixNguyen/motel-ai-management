// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import MotelSetupWizard from "@/components/manager/motel-setup-wizard";
import ContractManagementClient from "@/components/manager/contract-management-client";
import type { MotelResponse, TemplatePreview } from "@/lib/api/types";

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
  notify: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  submitMotelSetup: vi.fn(),
  getMotelSetupResult: vi.fn(),
  listContractCatalog: vi.fn(),
  previewCatalogTemplate: vi.fn(),
  previewOwnedTemplate: vi.fn(),
  listContractTemplates: vi.fn(),
  copyCatalogTemplate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => mocks.notify,
}));

vi.mock("@/lib/api/motel-setup.client", () => ({
  submitMotelSetup: mocks.submitMotelSetup,
  getMotelSetupResult: mocks.getMotelSetupResult,
  listContractCatalog: mocks.listContractCatalog,
  previewCatalogTemplate: mocks.previewCatalogTemplate,
  previewOwnedTemplate: mocks.previewOwnedTemplate,
  copyCatalogTemplate: mocks.copyCatalogTemplate,
}));

vi.mock("@/lib/api/contracts.client", () => ({
  listContractTemplates: mocks.listContractTemplates,
}));

const sampleMotel: MotelResponse = {
  id: "m-existing-1",
  managerId: "mgr-1",
  name: "Nhà Cũ",
  address: "123 Đường Cũ",
  electricityPrice: "3500",
  waterPrice: "25000",
  otherFees: [{ name: "Wifi", amount: "50000" }],
  bankAccount: { bankCode: "970436", accountNumber: "999999", accountName: "CHỦ NHÀ" },
  createdAt: "2026-01-01T00:00:00.000Z",
};

const sampleCatalogPreview: TemplatePreview = {
  name: "Mẫu chuẩn nhà trọ",
  clauses: [{ title: "Điều 1", content: "Nội dung điều 1" }],
  selection: { kind: "catalog", key: "vn-residential-standard", version: 1 },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("MotelSetupWizard", () => {
  beforeEach(() => {
    mocks.submitMotelSetup.mockReset();
    mocks.getMotelSetupResult.mockReset();
    mocks.listContractCatalog.mockReset();
    mocks.previewCatalogTemplate.mockReset();
    mocks.previewOwnedTemplate.mockReset();
    mocks.listContractTemplates.mockReset();
    mocks.copyCatalogTemplate.mockReset();

    mocks.listContractCatalog.mockResolvedValue([
      {
        key: "vn-residential-standard",
        version: 1,
        name: "Mẫu chuẩn nhà trọ",
        description: "Hợp đồng thuê phòng trọ chuẩn",
      },
    ]);
    mocks.previewCatalogTemplate.mockResolvedValue(sampleCatalogPreview);
    mocks.listContractTemplates.mockResolvedValue([]);
  });

  test("first_motel_has_no_skip: empty motels disables/hides skip, cancel closes without submit", () => {
    const onClose = vi.fn();
    const view = render(
      <MotelSetupWizard open={true} onClose={onClose} motels={[]} managerId="mgr-1" />,
    );

    expect(view.queryByRole("button", { name: /Tạo nhanh/ })).toBeNull();
    const cancelButton = view.getByRole("button", { name: "Hủy" });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
    expect(mocks.submitMotelSetup).not.toHaveBeenCalled();
  });

  test("existing motel shows skip button in Step 1", () => {
    const onClose = vi.fn();
    const view = render(
      <MotelSetupWizard
        open={true}
        onClose={onClose}
        motels={[sampleMotel]}
        managerId="mgr-1"
      />,
    );

    expect(view.getByRole("button", { name: /Tạo nhanh/ })).toBeInTheDocument();
  });

  test("restored unknown request keeps key and frozen payload without new-key submit", async () => {
    const savedId = "00000000-0000-4000-8000-000000000123";
    sessionStorage.setItem("motel-setup-draft:mgr-1", JSON.stringify({
      version: 1,
      mode: "quick",
      motel: { name: "Frozen Motel", address: "", electricityPrice: "3500", waterPrice: "25000", otherFees: [] },
      template: null,
      rooms: [],
      pendingRequestId: savedId,
    }));
    mocks.getMotelSetupResult.mockRejectedValue({ status: 404 });
    const randomUUID = vi.spyOn(crypto, "randomUUID");
    const view = render(<MotelSetupWizard open={true} onClose={vi.fn()} motels={[sampleMotel]} managerId="mgr-1" />);
    await waitFor(() => expect(mocks.getMotelSetupResult).toHaveBeenCalledWith(savedId));
    expect(view.getByLabelText("Tên nhà trọ")).toHaveValue("Frozen Motel");
    expect(randomUUID).not.toHaveBeenCalled();
    expect(mocks.submitMotelSetup).not.toHaveBeenCalled();
    randomUUID.mockRestore();
  });

  test("copy from existing motel applies selected groups without overwriting name/address", async () => {
    const onClose = vi.fn();
    const view = render(
      <MotelSetupWizard
        open={true}
        onClose={onClose}
        motels={[sampleMotel]}
        managerId="mgr-1"
      />,
    );

    fireEvent.change(view.getByLabelText("Tên nhà trọ"), { target: { value: "Nhà Mới Test" } });
    fireEvent.change(view.getByLabelText("Địa chỉ (không bắt buộc)"), {
      target: { value: "456 Đường Mới" },
    });

    const sourceSelect = view.getByLabelText("Chọn nhà trọ nguồn");
    fireEvent.change(sourceSelect, { target: { value: sampleMotel.id } });

    const bankCheckbox = view.getByLabelText(/Tài khoản nhận tiền/);
    const serviceCheckbox = view.getByLabelText("Giá điện, nước và phí khác");
    expect(bankCheckbox).not.toBeChecked();
    expect(serviceCheckbox).not.toBeChecked();

    fireEvent.click(bankCheckbox);
    fireEvent.click(serviceCheckbox);

    const applyButton = view.getByRole("button", { name: "Áp dụng" });
    fireEvent.click(applyButton);

    expect(view.getByLabelText("Tên nhà trọ")).toHaveValue("Nhà Mới Test");
    expect(view.getByLabelText("Địa chỉ (không bắt buộc)")).toHaveValue("456 Đường Mới");
    expect(view.getByLabelText("Giá điện (₫/kWh)")).toHaveValue("3.500");
    expect(view.getByLabelText("Giá nước (₫/m³)")).toHaveValue("25.000");
    expect(view.getByLabelText("Số tài khoản")).toHaveValue("999999");
  });

  test("template selection in Step 2 preview clauses", async () => {
    const onClose = vi.fn();
    const view = render(
      <MotelSetupWizard
        open={true}
        onClose={onClose}
        motels={[sampleMotel]}
        managerId="mgr-1"
      />,
    );

    fireEvent.change(view.getByLabelText("Tên nhà trọ"), { target: { value: "Nhà Bước 2" } });
    fireEvent.change(view.getByLabelText("Giá điện (₫/kWh)"), { target: { value: "3500" } });
    fireEvent.change(view.getByLabelText("Giá nước (₫/m³)"), { target: { value: "25000" } });

    fireEvent.click(view.getByRole("button", { name: "Tiếp tục" }));

    await waitFor(() => {
      expect(view.getByText("Bước 2: Mẫu hợp đồng")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(view.getByText("Mẫu chuẩn nhà trọ")).toBeInTheDocument();
      expect(view.getByText("Điều 1")).toBeInTheDocument();
    });
  });

  test("room generation in Step 3 generates rooms and allows editing", async () => {
    const onClose = vi.fn();
    const view = render(
      <MotelSetupWizard
        open={true}
        onClose={onClose}
        motels={[sampleMotel]}
        managerId="mgr-1"
      />,
    );

    fireEvent.change(view.getByLabelText("Tên nhà trọ"), { target: { value: "Nhà Bước 3" } });
    fireEvent.change(view.getByLabelText("Giá điện (₫/kWh)"), { target: { value: "3500" } });
    fireEvent.change(view.getByLabelText("Giá nước (₫/m³)"), { target: { value: "25000" } });
    fireEvent.click(view.getByRole("button", { name: "Tiếp tục" }));

    await waitFor(() => expect(view.getByText("Bước 2: Mẫu hợp đồng")).toBeInTheDocument());
    fireEvent.click(view.getByRole("button", { name: "Tiếp tục" }));

    await waitFor(() => expect(view.getByText("Bước 3: Danh sách phòng")).toBeInTheDocument());

    fireEvent.change(view.getByLabelText("Tiền tố phòng"), { target: { value: "P." } });
    fireEvent.change(view.getByLabelText("Số bắt đầu"), { target: { value: "101" } });
    fireEvent.change(view.getByLabelText("Số lượng phòng"), { target: { value: "3" } });
    fireEvent.change(view.getByLabelText("Giá thuê mặc định (₫)"), {
      target: { value: "2500000" },
    });

    fireEvent.click(view.getByRole("button", { name: "Sinh danh sách phòng" }));

    expect(view.getByDisplayValue("P.101")).toBeInTheDocument();
    expect(view.getByDisplayValue("P.102")).toBeInTheDocument();
    expect(view.getByDisplayValue("P.103")).toBeInTheDocument();

    fireEvent.change(view.getByDisplayValue("P.101"), { target: { value: "P.VIP-1" } });
    expect(view.getByDisplayValue("P.VIP-1")).toBeInTheDocument();
  });

  test("full setup reviews and submits N rooms with selected template", async () => {
    const onClose = vi.fn();
    mocks.submitMotelSetup.mockResolvedValue({
      motelId: "m-created-1",
      mode: "full",
      roomCount: 2,
      templateId: "tpl-1",
    });

    const view = render(
      <MotelSetupWizard
        open={true}
        onClose={onClose}
        motels={[sampleMotel]}
        managerId="mgr-1"
      />,
    );

    fireEvent.change(view.getByLabelText("Tên nhà trọ"), { target: { value: "Nhà Full" } });
    fireEvent.change(view.getByLabelText("Giá điện (₫/kWh)"), { target: { value: "3500" } });
    fireEvent.change(view.getByLabelText("Giá nước (₫/m³)"), { target: { value: "25000" } });
    fireEvent.click(view.getByRole("button", { name: "Tiếp tục" }));

    await waitFor(() => expect(view.getByText("Bước 2: Mẫu hợp đồng")).toBeInTheDocument());
    fireEvent.click(view.getByRole("button", { name: "Tiếp tục" }));

    await waitFor(() => expect(view.getByText("Bước 3: Danh sách phòng")).toBeInTheDocument());
    fireEvent.change(view.getByLabelText("Số lượng phòng"), { target: { value: "2" } });
    fireEvent.change(view.getByLabelText("Giá thuê mặc định (₫)"), {
      target: { value: "2000000" },
    });
    fireEvent.click(view.getByRole("button", { name: "Sinh danh sách phòng" }));

    fireEvent.click(view.getByRole("button", { name: "Tiếp tục" }));

    await waitFor(() => expect(view.getByText("Bước 4: Xác nhận và hoàn tất")).toBeInTheDocument());
    expect(view.getByText("2 phòng")).toBeInTheDocument();
    expect(view.getByText("Mẫu chuẩn nhà trọ")).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Hoàn tất thiết lập" }));

    await waitFor(() => {
      expect(mocks.submitMotelSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "full",
          rooms: expect.arrayContaining([expect.objectContaining({ name: "101" })]),
        }),
      );
      expect(mocks.notify).toHaveBeenCalledWith({ message: "Đã tạo nhà trọ thành công" });
      expect(onClose).toHaveBeenCalled();
    });
  });

  test("quick setup skips to Step 4 with 0 rooms and preserves template", async () => {
    const onClose = vi.fn();
    mocks.submitMotelSetup.mockResolvedValue({
      motelId: "m-quick-1",
      mode: "quick",
      roomCount: 0,
      templateId: "tpl-1",
    });

    const view = render(
      <MotelSetupWizard
        open={true}
        onClose={onClose}
        motels={[sampleMotel]}
        managerId="mgr-1"
      />,
    );

    fireEvent.change(view.getByLabelText("Tên nhà trọ"), { target: { value: "Nhà Nhanh" } });
    fireEvent.change(view.getByLabelText("Giá điện (₫/kWh)"), { target: { value: "3500" } });
    fireEvent.change(view.getByLabelText("Giá nước (₫/m³)"), { target: { value: "25000" } });

    fireEvent.click(view.getByRole("button", { name: /Tạo nhanh/ }));

    await waitFor(() => expect(view.getByText("Bước 4: Xác nhận và hoàn tất")).toBeInTheDocument());
    expect(view.getByText("0 phòng (Tạo nhanh)")).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Hoàn tất thiết lập" }));

    await waitFor(() => {
      expect(mocks.submitMotelSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "quick",
        }),
      );
      expect(mocks.notify).toHaveBeenCalledWith({ message: "Đã tạo nhanh nhà trọ" });
      expect(onClose).toHaveBeenCalled();
    });
  });

  test("on submit error, allows retry with same requestId and 410 blocks resubmission", async () => {
    const onClose = vi.fn();
    mocks.submitMotelSetup
      .mockRejectedValueOnce(new Error("Lỗi kết nối mạng"))
      .mockRejectedValueOnce({ status: 410, message: "Yêu cầu đã bị hủy hoặc xóa" })
      .mockResolvedValueOnce({
        motelId: "m-retry-1",
        mode: "quick",
        roomCount: 0,
        templateId: null,
      });

    const view = render(
      <MotelSetupWizard
        open={true}
        onClose={onClose}
        motels={[sampleMotel]}
        managerId="mgr-1"
      />,
    );

    fireEvent.change(view.getByLabelText("Tên nhà trọ"), { target: { value: "Nhà Retry" } });
    fireEvent.change(view.getByLabelText("Giá điện (₫/kWh)"), { target: { value: "3500" } });
    fireEvent.change(view.getByLabelText("Giá nước (₫/m³)"), { target: { value: "25000" } });

    fireEvent.click(view.getByRole("button", { name: /Tạo nhanh/ }));
    await waitFor(() => expect(view.getByText("Bước 4: Xác nhận và hoàn tất")).toBeInTheDocument());

    fireEvent.click(view.getByRole("button", { name: "Hoàn tất thiết lập" }));
    await waitFor(() => expect(view.getByRole("alert")).toHaveTextContent("Lỗi kết nối mạng"));

    const firstRequestId = mocks.submitMotelSetup.mock.calls[0]![0].requestId;
    expect(firstRequestId).toBeDefined();

    fireEvent.click(view.getByRole("button", { name: "Hoàn tất thiết lập" }));
    await waitFor(() =>
      expect(view.getByRole("alert")).toHaveTextContent("Không thể tạo nhà trọ. Vui lòng thử lại."),
    );

    const secondRequestId = mocks.submitMotelSetup.mock.calls[1]![0].requestId;
    expect(secondRequestId).toBe(firstRequestId);

    expect(view.getByRole("alert")).toHaveTextContent("Không thể tạo nhà trọ. Vui lòng thử lại.");
    expect(view.getByRole("button", { name: "Hoàn tất thiết lập" })).toBeDisabled();
    expect(mocks.submitMotelSetup).toHaveBeenCalledTimes(2);
    expect(mocks.submitMotelSetup.mock.calls[1]![0].requestId).toBe(firstRequestId);
  });

  test("late owned-template preview cannot replace selection after source change", async () => {
    const second: MotelResponse = { ...sampleMotel, id: "m-existing-2", name: "Nguồn hai" };
    const firstTemplate = { id: "tpl-1", motelId: sampleMotel.id, name: "Mẫu A", clauses: [], isDefault: false, createdAt: "2026-01-01T00:00:00.000Z" };
    const secondTemplate = { ...firstTemplate, id: "tpl-2", motelId: second.id, name: "Mẫu B" };
    let resolveFirstPreview!: (preview: TemplatePreview) => void;
    mocks.listContractTemplates.mockImplementation((motelId: string) => Promise.resolve(motelId === sampleMotel.id ? [firstTemplate] : [secondTemplate]));
    mocks.previewOwnedTemplate
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirstPreview = resolve; }))
      .mockResolvedValueOnce({ ...sampleCatalogPreview, name: "Preview B", selection: { kind: "motel", motelId: second.id, templateId: secondTemplate.id, fingerprint: "b" } });
    const view = render(<MotelSetupWizard open={true} onClose={vi.fn()} motels={[sampleMotel, second]} managerId="mgr-1" />);
    fireEvent.change(view.getByLabelText("Tên nhà trọ"), { target: { value: "Nhà mới" } });
    fireEvent.change(view.getByLabelText("Giá điện (₫/kWh)"), { target: { value: "3500" } });
    fireEvent.change(view.getByLabelText("Giá nước (₫/m³)"), { target: { value: "25000" } });
    const source = view.getByLabelText("Chọn nhà trọ nguồn");
    fireEvent.change(source, { target: { value: sampleMotel.id } });
    await waitFor(() => expect(mocks.listContractTemplates).toHaveBeenCalledWith(sampleMotel.id));
    await waitFor(() => expect(view.getByLabelText(/Mẫu hợp đồng/)).toBeEnabled());
    fireEvent.click(view.getByLabelText(/Mẫu hợp đồng/));
    await waitFor(() => expect(view.getByRole("option", { name: "Mẫu A" })).toBeInTheDocument());
    fireEvent.click(view.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => expect(mocks.previewOwnedTemplate).toHaveBeenCalledTimes(1));

    fireEvent.change(source, { target: { value: second.id } });
    await waitFor(() => expect(mocks.listContractTemplates).toHaveBeenCalledWith(second.id));
    await waitFor(() => expect(view.getByRole("option", { name: "Mẫu B" })).toBeInTheDocument());
    fireEvent.click(view.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => expect(mocks.previewOwnedTemplate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(view.queryByText("Không thể tải mẫu từ nhà trọ đã chọn")).toBeNull());
    expect(view.getByText("Mẫu B")).toBeInTheDocument();

    resolveFirstPreview({ ...sampleCatalogPreview, name: "Stale preview A", selection: { kind: "motel", motelId: sampleMotel.id, templateId: firstTemplate.id, fingerprint: "a" } });
    await waitFor(() => expect(mocks.previewOwnedTemplate).toHaveBeenCalledTimes(2));
    expect(view.getByRole("option", { name: "Mẫu B" })).toBeInTheDocument();
    expect(view.queryByText("Stale preview A")).toBeNull();
  });

  test("canceling services copy preserves edited prices and fees, confirming applies", async () => {
    const view = render(
      <MotelSetupWizard open={true} onClose={vi.fn()} motels={[sampleMotel]} managerId="mgr-1" />,
    );
    const electricity = view.getByLabelText("Giá điện (₫/kWh)");
    fireEvent.change(electricity, { target: { value: "9999" } });
    fireEvent.change(view.getByLabelText("Chọn nhà trọ nguồn"), {
      target: { value: sampleMotel.id },
    });
    fireEvent.click(view.getByLabelText("Giá điện, nước và phí khác"));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(view.getByRole("button", { name: "Áp dụng" }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(electricity).toHaveValue("9999");
    confirmSpy.mockReturnValue(true);
    fireEvent.click(view.getByRole("button", { name: "Áp dụng" }));
    expect(electricity).toHaveValue("3.500");
    confirmSpy.mockRestore();
  });

  test("changing source does not overwrite manually edited bank without confirmation", async () => {
    const onClose = vi.fn();
    const secondMotel: MotelResponse = {
      ...sampleMotel,
      id: "m-existing-2",
      name: "Nhà Thứ Hai",
      bankAccount: { bankCode: "123456", accountNumber: "777777", accountName: "CHỦ NHÀ 2" },
    };

    const confirmSpy = vi.spyOn(window, "confirm");
    confirmSpy.mockReturnValue(false);

    const view = render(
      <MotelSetupWizard
        open={true}
        onClose={onClose}
        motels={[sampleMotel, secondMotel]}
        managerId="mgr-1"
      />,
    );

    fireEvent.click(view.getByLabelText("Thiết lập tài khoản nhận tiền"));
    fireEvent.change(view.getByLabelText("Số tài khoản"), { target: { value: "MANUAL_BANK" } });

    fireEvent.change(view.getByLabelText("Chọn nhà trọ nguồn"), {
      target: { value: secondMotel.id },
    });
    fireEvent.click(view.getByLabelText(/Tài khoản nhận tiền/));
    fireEvent.click(view.getByRole("button", { name: "Áp dụng" }));

    expect(confirmSpy).toHaveBeenCalledWith("Ghi đè cấu hình đã nhập?");
    expect(view.getByLabelText("Số tài khoản")).toHaveValue("MANUAL_BANK");

    confirmSpy.mockReturnValue(true);
    fireEvent.click(view.getByRole("button", { name: "Áp dụng" }));
    expect(view.getByLabelText("Số tài khoản")).toHaveValue("777777");
    confirmSpy.mockRestore();
  });

  test("contract management adds Chọn mẫu có sẵn button and copies catalog template", async () => {
    mocks.copyCatalogTemplate.mockResolvedValue({
      id: "tpl-copied-1",
      motelId: "m-existing-1",
      name: "Mẫu chuẩn nhà trọ",
      clauses: [{ title: "Điều 1", content: "Nội dung điều 1" }],
      isDefault: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const view = render(
      <ContractManagementClient
        motelId="m-existing-1"
        renters={[]}
        rooms={[]}
        contracts={[]}
        templates={[]}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: "Mẫu hợp đồng" }));
    expect(view.getByRole("button", { name: "Chọn mẫu có sẵn" })).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Chọn mẫu có sẵn" }));
    expect(view.getByText("Chọn mẫu từ thư viện")).toBeInTheDocument();

    await waitFor(() => {
      expect(view.getByText("Mẫu chuẩn nhà trọ")).toBeInTheDocument();
    });

    fireEvent.click(view.getByRole("button", { name: "Áp dụng mẫu" }));

    await waitFor(() => {
      expect(mocks.copyCatalogTemplate).toHaveBeenCalledWith("m-existing-1", {
        catalogKey: "vn-residential-standard",
        catalogVersion: 1,
        isDefault: false,
      });
      expect(mocks.notify).toHaveBeenCalledWith({ message: "Đã thêm mẫu hợp đồng từ thư viện" });
    });
  });
});
