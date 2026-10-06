import { createElement as h } from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Button from "../button";
import Field from "../field";
import Badge from "../badge";
import StatCard from "../stat-card";
import EmptyState from "../empty-state";
import Skeleton from "../skeleton";
import TruncatedText from "../truncated-text";
import Modal from "../modal";
import Drawer from "../drawer";
import CopyButton from "../copy-button";
import FilterBar from "../filter-bar";
import DataTable from "../data-table";
import { ToastProvider } from "../toast";

describe("component kit accessibility", () => {
  for (const variant of ["primary", "secondary", "ghost", "danger"] as const) {
    for (const size of ["sm", "md", "lg"] as const) {
      it(`${variant}/${size} preserves a 44px hit area and keyboard focus`, () => {
        const html = render(h(Button, { variant, size }, "Lưu"));
        expect(html).toContain('type="button"');
        expect(html).toContain("min-h-11");
        expect(html).toContain("min-w-11");
        expect(html).toContain("focus-visible:ring-2");
        expect(html).toContain("Lưu");
      });
    }
  }
  it("prevents another submission while pending and announces progress", () => {
    const html = render(h(Button, { pending: true, pendingLabel: "Đang lưu…", type: "submit" }, "Lưu"));
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Đang lưu…");
    expect(render(h(Button, { disabled: true }, "Lưu"))).toContain('disabled=""');
  });
  it("preserves hints and caller descriptions when an inline error appears", () => {
    const html = render(h(Field, { id: "rent", label: "Tiền thuê", hint: "Nhập số đồng", describedBy: "currency", error: "Nhập số tiền hợp lệ", children: (props) => h("input", props) }));
    expect(html).toContain('for="rent"');
    expect(html).toContain('aria-describedby="currency rent-hint rent-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="rent-hint"');
    expect(html).toContain('id="rent-error"');
  });
  it("gives its control a touch target, a visible boundary, and keyboard focus by default", () => {
    const html = render(h(Field, { id: "room", label: "Tên phòng", children: (props) => h("input", props) }));
    expect(html).toContain("min-h-11");
    expect(html).toContain("border-border-strong");
    expect(html).toContain("focus-visible:ring-2");
  });
  for (const [tone, fg, bg] of [["success", "text-success", "bg-success-bg"], ["warning", "text-warning", "bg-warning-bg"], ["danger", "text-danger", "bg-danger-bg"], ["neutral", "text-text-muted", "bg-canvas"]] as const) {
    it(`${tone} badge shows a text label as well as its semantic tone`, () => {
      const html = render(h(Badge, { tone, label: "Trạng thái" }));
      expect(html).toContain("Trạng thái");
      expect(html).toContain(fg);
      expect(html).toContain(bg);
    });
  }
  it("provides the full truncated value to sighted and screen-reader users", () => {
    const value = "Nguyễn Thị Ánh Hồng — nhà trọ số 123";
    const html = render(h(TruncatedText, { value }));
    expect(html).toContain(`title="${value}"`);
    expect(html).toContain(`aria-label="${value}"`);
    expect(html).toMatch(/class="sr-only"[^>]*>Nguyễn Thị Ánh Hồng/);
    expect(html).toContain("truncate");
    expect(html).toContain('aria-hidden="true"');
  });
  it("aligns statistical amounts and keeps their context", () => {
    const html = render(h(StatCard, { label: "Tiền thuê", value: "3.500.000 ₫", description: "Phòng 101" }));
    expect(html).toContain("tabular-nums");
    expect(html).toContain("3.500.000 ₫");
    expect(html).toContain("Phòng 101");
  });
  it("names the next action in an empty state", () => {
    const html = render(h(EmptyState, { title: "Chưa có phòng", description: "Thêm phòng để bắt đầu quản lý", actionLabel: "Thêm phòng", onAction: () => {} }));
    expect(html).toContain("Thêm phòng để bắt đầu quản lý");
    expect(html).toMatch(/<button[^>]*>Thêm phòng<\/button>/);
  });
  it("announces skeleton loading and disables its animation for reduced motion", () => {
    const html = render(h(Skeleton, { label: "Đang tải phòng…" }));
    expect(html).toContain('role="status"');
    expect(html).toContain("Đang tải phòng…");
    expect(html).toContain("motion-safe:animate-pulse");
    expect(html).toContain('aria-hidden="true"');
  });
  for (const Component of [Modal, Drawer]) {
    it(`${Component.name} supplies a labelled native dialog and a labelled close button`, () => {
      const html = render(h(Component, { open: false, onClose: () => {}, title: "Sửa phòng", description: "Lưu thông tin phòng", children: h("input", { "aria-label": "Tên phòng" }) }));
      expect(html).toContain("<dialog");
      expect(html).toMatch(/aria-labelledby="[^"]+"/);
      expect(html).toMatch(/aria-describedby="[^"]+"/);
      expect(html).toContain("Đóng");
      expect(html).not.toContain('open=""');
    });
  }
  it("labels copy and search controls and prepares a quiet toast live region", () => {
    expect(render(h(CopyButton, { value: "https://example.test/r/token" }))).toContain("Sao chép");
    const filter = render(h(FilterBar, { search: "", onSearchChange: () => {}, searchLabel: "Tìm khách thuê" }, h("select", { "aria-label": "Trạng thái" })));
    expect(filter).toContain("Tìm khách thuê");
    expect(filter).toContain('type="search"');
    expect(render(h(ToastProvider, null, "Nội dung"))).toContain('aria-live="polite"');
  });
  it("renders real table headers, pagination, searchable data, and money-cell alignment", () => {
    const html = render(h(DataTable<{ id: string; name: string; rent: string }>, {
      rows: [{ id: "1", name: "Ánh", rent: "3500000" }, { id: "2", name: "Bình", rent: "2500000" }],
      columns: [{ key: "name", label: "Họ tên", render: (row) => row.name, sortValue: (row) => row.name }, { key: "rent", label: "Tiền thuê", render: (row) => row.rent, sortValue: (row) => BigInt(row.rent), money: true }],
      getRowId: (row) => row.id, searchText: (row) => row.name, pageSize: 1, caption: "Khách thuê",
    }));
    expect(html).toContain("<caption");
    expect(html).toContain('scope="col"');
    expect(html).toContain('aria-sort="none"');
    expect(html).toContain("Tìm kiếm");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("Trang 1 / 2");
    expect(html).toContain('data-label="Tiền thuê"');
    expect(html).toContain("3500000");
    expect(html).not.toContain(">2500000<");
  });
});
