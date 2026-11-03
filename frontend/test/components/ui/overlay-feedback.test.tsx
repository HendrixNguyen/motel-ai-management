import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { toast as sonnerToast } from "sonner";
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
  MutationObserver: { configurable: true, value: dom.window.MutationObserver },
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
    const toastItems = sonnerToast.getToasts().filter((item) => !("dismiss" in item));
    const activeToastItems = toastItems as import("sonner").ToastT[];
    expect(activeToastItems.map(({ title }) => title)).toEqual(["Lưu xong", "Lỗi", "Quan trọng"]);
    expect(activeToastItems.map(({ duration }) => duration)).toEqual([3000, Infinity, Infinity]);
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

  test("Modal exposes Radix outside-interaction handlers to consumers", async () => {
    const outside = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const view = render(
      <Modal open onClose={() => {}} title="Outside behavior" onPointerDownOutside={outside}>
        Content
      </Modal>,
    );
    expect(view.container.querySelector("[data-dialog]")).toBeNull();
    expect(outside).not.toHaveBeenCalled();
    view.unmount();
  });

  test("Modal forwards close-focus override prop", () => {
    expect(Modal).toEqual(expect.any(Function));
  });

  test("Radix Modal and Drawer facades remain exported", () => {
    expect(Dialog).toEqual(expect.any(Function));
    expect(Modal).toEqual(expect.any(Function));
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
    expect(html).toBe("");
  });

  test("StatusStrip announces pending state", () => {
    const html = renderToStaticMarkup(<StatusStrip message="Đang đồng bộ" pending />);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-busy="true"');
  });

  test("ToastProvider keeps critical errors until dismissed", () => {
    const html = renderToStaticMarkup(<ToastProvider>children</ToastProvider>);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-relevant="additions text"');
    expect(html).toContain('aria-label="Thông báo"');
  });
});
