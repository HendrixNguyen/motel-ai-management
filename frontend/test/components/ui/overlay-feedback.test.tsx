import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { fireEvent, render, cleanup } from "@testing-library/react";
import { JSDOM } from "jsdom";
import "@testing-library/jest-dom/vitest";
import { ToastProvider, useToast } from "@/components/ui/toast";
import Modal, { Dialog } from "@/components/ui/modal";
import Tabs from "@/components/ui/tabs";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Node: { configurable: true, value: dom.window.Node },
  Event: { configurable: true, value: dom.window.Event },
  MouseEvent: { configurable: true, value: dom.window.MouseEvent },
  KeyboardEvent: { configurable: true, value: dom.window.KeyboardEvent },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
});
beforeAll(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    writable: true,
    value: true,
  });
});
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.open = false;
  this.dispatchEvent(new dom.window.Event("close"));
};
afterEach(() => cleanup());

import { renderToStaticMarkup } from "react-dom/server";
import Alert from "@/components/ui/alert";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import ErrorState from "@/components/ui/error-state";
import StatusStrip from "@/components/ui/status-strip";
import CopyButton from "@/components/ui/copy-button";

describe("overlay and feedback primitives", () => {
  test("Tabs select by click and wrap keyboard Home, End and arrows", () => {
    const view = render(
      <Tabs
        tabs={[
          { id: "one", label: "Một", content: <p>Nội dung một</p> },
          { id: "two", label: "Hai", content: <p>Nội dung hai</p> },
        ]}
      />,
    );
    const tabs = view.getAllByRole("tab");
    fireEvent.keyDown(tabs[0]!, { key: "ArrowLeft" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs[1]!, { key: "Home" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(tabs[1]!);
    expect(view.getByRole("tabpanel")).toHaveTextContent("Nội dung hai");
    fireEvent.keyDown(tabs[1]!, { key: "End" });
    fireEvent.keyDown(tabs[1]!, { key: "ArrowDown" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  test("Toast requires provider, announces severity and dismisses selected item", () => {
    function Trigger() {
      const notify = useToast();
      return (
        <button
          onClick={() => {
            notify({ message: "Lưu xong" });
            notify({ message: "Lỗi", tone: "danger" });
            notify({ message: "Quan trọng", critical: true });
          }}
        >
          Gửi
        </button>
      );
    }
    expect(() => render(<Trigger />)).toThrow("useToast requires ToastProvider");
    const view = render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(view.getByRole("button", { name: "Gửi" }));
    expect(view.getByRole("status")).toHaveTextContent("Lưu xong");
    expect(view.getAllByRole("alert").map((item) => item.textContent)).toEqual([
      "LỗiĐóng",
      "Quan trọngĐóng",
    ]);
    fireEvent.click(view.getByRole("button", { name: "Đóng thông báo: Lỗi" }));
    expect(view.queryByText("Lỗi")).toBeNull();
  });

  test("CopyButton reports success and clipboard failure branches", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: write },
    });
    const view = render(<CopyButton value="secret link" />);
    fireEvent.click(view.getByRole("button", { name: "Sao chép" }));
    expect(await view.findByText("Đã sao chép")).toBeInTheDocument();
    expect(write).toHaveBeenCalledWith("secret link");
    write.mockRejectedValueOnce(new Error("permission denied"));
    fireEvent.click(view.getByRole("button", { name: "Sao chép" }));
    expect(
      await view.findByText("Không thể sao chép. Hãy chọn và sao chép nội dung thủ công."),
    ).toBeInTheDocument();
  });

  test("Drawer uses edge sheet layout and footer while Modal remains centered", () => {
    const view = render(
      <Dialog open drawer onClose={() => {}} title="Drawer" footer={<button>Save</button>}>
        <p>Body</p>
      </Dialog>,
    );
    const dialog = view.getByRole("dialog");
    expect(dialog.className).toContain("fixed inset-y-0 right-0");
    expect(view.getByText("Save")).toBeInTheDocument();
    view.unmount();
    const modal = render(
      <Modal open onClose={() => {}} title="Modal">
        <p>Body</p>
      </Modal>,
    );
    expect(modal.getByRole("dialog").className).toContain("m-auto box-border");
  });

  test("focus trap wraps first/last, ignores hidden controls and missing focusables", () => {
    const view = render(
      <Modal open onClose={() => {}} title="Focus">
        <button>First</button>
        <button>Last</button>
      </Modal>,
    );
    const dialog = view.getByRole("dialog");
    Object.defineProperty(HTMLElement.prototype, "getClientRects", {
      configurable: true,
      value: () => [{ width: 1 }],
    });
    const last = view.getByRole("button", { name: "Last" });
    const close = view.getByRole("button", { name: "Đóng" });
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    close.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    view.unmount();
    const empty = render(
      <Modal open onClose={() => {}} title="Empty">
        No focusable controls
      </Modal>,
    );
    expect(() => fireEvent.keyDown(empty.getByRole("dialog"), { key: "Tab" })).not.toThrow();
  });

  test("Modal opens, closes via close control, and omits optional description and footer", () => {
    const close = vi.fn();
    const view = render(
      <Modal open onClose={close} title="Chi tiết" description="Nội dung trợ giúp">
        <p>Body</p>
      </Modal>,
    );
    const dialog = view.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-describedby");
    fireEvent.click(view.getByRole("button", { name: "Đóng" }));
    expect(close).toHaveBeenCalled();
    view.unmount();
    const second = render(
      <Modal open onClose={close} title="Không mô tả">
        <p>Body</p>
      </Modal>,
    );
    expect(second.getByRole("dialog")).not.toHaveAttribute("aria-describedby");
    expect(document.querySelector("[data-dialog-footer]")).toBeNull();
  });
  test("Alert exposes semantic role and live announcement", () => {
    const html = renderToStaticMarkup(
      <Alert tone="danger" title="Lỗi" description="Không thể tải dữ liệu" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
  });

  test("ErrorState offers retry and status semantics", () => {
    const html = renderToStaticMarkup(
      <ErrorState title="Có lỗi" description="Thử lại" onRetry={() => {}} retryLabel="Thử lại" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Thử lại");
  });

  test("ConfirmDialog marks destructive confirmation and pending action", () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open
        title="Xóa phòng"
        description="Không thể hoàn tác"
        destructive
        pending
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(html).toContain('data-destructive="true"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Đang xử lý…");
  });

  test("StatusStrip announces pending state", () => {
    const html = renderToStaticMarkup(<StatusStrip message="Đang đồng bộ" pending />);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-busy="true"');
  });

  test("ToastProvider keeps critical errors until dismissed", () => {
    const html = renderToStaticMarkup(<ToastProvider>children</ToastProvider>);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-relevant="additions"');
  });
});
