import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Card from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import Skeleton from "@/components/ui/skeleton";
import StatusBadge from "@/components/ui/status-badge";

describe("Core UI v2 migration states", () => {
  it("renders shared empty state with actionable copy", () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { title: "Chưa có dữ liệu", description: "Bắt đầu thêm dữ liệu.", actionLabel: "Thêm mới", onAction: () => {} }));
    expect(html).toContain("Chưa có dữ liệu");
    expect(html).toContain("Thêm mới");
  });

  it("renders loading state with accessible status", () => {
    const html = renderToStaticMarkup(createElement(Skeleton, { label: "Đang tải phòng" }));
    expect(html).toContain('role="status"');
    expect(html).toContain("Đang tải phòng");
  });

  it("keeps semantic status and dark-theme token classes in shared surfaces", () => {
    const html = renderToStaticMarkup(createElement(Card, null, createElement(StatusBadge, { label: "Đang xử lý", tone: "warning" })));
    expect(html).toContain("bg-surface");
    expect(html).toContain("bg-warning-bg");
  });
});
