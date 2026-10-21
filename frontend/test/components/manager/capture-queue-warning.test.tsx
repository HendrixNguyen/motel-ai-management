import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { JSDOM } from "jsdom";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  legacy: vi.fn(),
  clear: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));
vi.mock("@/lib/capture/queue", () => ({
  CaptureQueue: class {
    list = mocks.list;
    hasLegacyRows = mocks.legacy;
  },
  clearCaptureQueue: mocks.clear,
}));
vi.mock("@/lib/api/auth.client", () => ({ logout: mocks.logout }));
import CaptureQueueWarning from "@/components/manager/capture-queue-warning";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/rooms?filter=active",
});
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Node: { configurable: true, value: dom.window.Node },
  Event: { configurable: true, value: dom.window.Event },
  CustomEvent: { configurable: true, value: dom.window.CustomEvent },
  MouseEvent: { configurable: true, value: dom.window.MouseEvent },
  URLSearchParams: { configurable: true, value: dom.window.URLSearchParams },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
});
beforeAll(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    writable: true,
    value: true,
  });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("CaptureQueueWarning behavior", () => {
  test("hides clean state and stale async queue results after unmount", async () => {
    mocks.list.mockResolvedValue([]);
    mocks.legacy.mockResolvedValue(false);
    const view = render(<CaptureQueueWarning managerId="m" motelId="mt" />);
    await waitFor(() => expect(mocks.list).toHaveBeenCalled());
    expect(view.container.firstChild).toBeNull();
    view.unmount();
  });

  test("blocks motel switch when dirty and preserves current route query on allowed switch", async () => {
    mocks.list.mockResolvedValue([{ id: "q", status: "pending" }]);
    mocks.legacy.mockResolvedValue(false);
    const view = render(<CaptureQueueWarning managerId="m" motelId="mt1" />);
    expect(await view.findByText(/1 mục nhập/)).toBeInTheDocument();
    const blocked = new CustomEvent("capture:motel-switch", { cancelable: true, detail: "mt2" });
    await act(async () => {
      window.dispatchEvent(blocked);
    });
    expect(blocked.defaultPrevented).toBe(true);
    expect(view.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(view.getByText("Quản lý dữ liệu ngoại tuyến"));
    expect(view.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(view.getByText("Giữ lại"));
    expect(view.queryByRole("alertdialog")).toBeNull();
  });

  test("blocks logout until manager explicitly chooses keep/remove; remove failures stay visible", async () => {
    mocks.list.mockResolvedValue([{ id: "q", status: "failed" }]);
    mocks.legacy.mockResolvedValue(false);
    const view = render(<CaptureQueueWarning managerId="m" motelId="mt" />);
    await view.findByText(/1 mục nhập/);
    const blocked = new Event("capture:logout", { cancelable: true });
    window.dispatchEvent(blocked);
    expect(blocked.defaultPrevented).toBe(true);
    mocks.clear.mockRejectedValueOnce(new Error("db failed"));
    fireEvent.click(view.getByText("Quản lý dữ liệu ngoại tuyến"));
    fireEvent.click(view.getByText("Xóa dữ liệu của tài khoản này"));
    expect(await view.findByRole("alert")).toHaveTextContent("Không thể xóa dữ liệu");
    mocks.clear.mockResolvedValueOnce(undefined);
    fireEvent.click(view.getByText("Xóa dữ liệu của tài khoản này"));
    await waitFor(() => expect(view.queryByRole("alertdialog")).toBeNull());
  });

  test("isolates legacy rows and handles queue inspection errors", async () => {
    mocks.list.mockResolvedValueOnce([{ id: "legacy", status: "pending" }]);
    mocks.legacy.mockResolvedValueOnce(true);
    const view = render(<CaptureQueueWarning managerId="m" motelId="mt" />);
    expect(await view.findByText(/Có dữ liệu chỉ số cũ/)).toBeInTheDocument();
    mocks.list.mockResolvedValueOnce([]);
    mocks.legacy.mockRejectedValueOnce(new Error("offline"));
    view.rerender(<CaptureQueueWarning managerId="m2" motelId="mt" />);
    await waitFor(() => expect(view.container.firstChild).toBeNull());
  });
});
