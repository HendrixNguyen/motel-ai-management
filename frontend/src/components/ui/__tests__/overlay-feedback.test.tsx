import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Alert from "../alert";
import ConfirmDialog from "../confirm-dialog";
import ErrorState from "../error-state";
import StatusStrip from "../status-strip";
import { ToastProvider } from "../toast";

describe("overlay and feedback primitives", () => {
  test("Alert exposes semantic role and live announcement", () => {
    const html = renderToStaticMarkup(<Alert tone="danger" title="Lỗi" description="Không thể tải dữ liệu" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
  });

  test("ErrorState offers retry and status semantics", () => {
    const html = renderToStaticMarkup(<ErrorState title="Có lỗi" description="Thử lại" onRetry={() => {}} retryLabel="Thử lại" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Thử lại");
  });

  test("ConfirmDialog marks destructive confirmation and pending action", () => {
    const html = renderToStaticMarkup(<ConfirmDialog open title="Xóa phòng" description="Không thể hoàn tác" destructive pending onClose={() => {}} onConfirm={() => {}} />);
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
