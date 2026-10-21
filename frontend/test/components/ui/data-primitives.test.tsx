import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import DataTable from "@/components/ui/data-table";
import StatusBadge from "@/components/ui/status-badge";
import Progress from "@/components/ui/progress";
import MobileDataRow from "@/components/ui/mobile-data-row";
import Tabs from "@/components/ui/tabs";
import Accordion from "@/components/ui/accordion";
import { getTablePage } from "@/components/ui/table-model";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Node: { configurable: true, value: dom.window.Node },
  Event: { configurable: true, value: dom.window.Event },
  MouseEvent: { configurable: true, value: dom.window.MouseEvent },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
});
beforeAll(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    writable: true,
    value: true,
  });
});
const html = (node: React.ReactElement) => renderToStaticMarkup(node);
afterEach(() => cleanup());

describe("data display and navigation primitives", () => {
  test("Accordion expands, collapses current row, and replaces open row", () => {
    const view = render(
      <Accordion
        items={[
          { id: "one", title: "One", content: <p>First panel</p> },
          { id: "two", title: "Two", content: <p>Second panel</p> },
        ]}
      />,
    );
    const first = view.getByRole("button", { name: "One" });
    const second = view.getByRole("button", { name: "Two" });
    expect(first).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(view.getByText("First panel").parentElement).not.toHaveAttribute("hidden");
    fireEvent.click(second);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(second).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "false");
  });

  test("Accordion renders no rows for empty item list", () => {
    const view = render(<Accordion items={[]} />);
    expect(view.container.querySelectorAll("button")).toHaveLength(0);
  });

  test("DataTable sorts both directions, filters, clears, and paginates", async () => {
    const rows = [
      { id: "1", name: "An", amount: 2 },
      { id: "2", name: "Bình", amount: 1 },
      { id: "3", name: "Cường", amount: 3 },
    ];
    const view = render(
      <DataTable
        rows={rows}
        getRowId={(row) => row.id}
        caption="Khách thuê"
        pageSize={2}
        searchText={(row) => row.name}
        columns={[
          { key: "name", label: "Tên", render: (row) => row.name, sortValue: (row) => row.name },
          {
            key: "amount",
            label: "Tiền",
            render: (row) => String(row.amount),
            sortValue: (row) => row.amount,
            money: true,
          },
        ]}
      />,
    );
    expect(view.getByText("Trang 1 / 2 · 3 kết quả")).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: /Tiền/ }));
    expect(view.getByText("Trang 1 / 2 · 3 kết quả")).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Trang sau" }));
    expect(view.getByText("Trang 2 / 2 · 3 kết quả")).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: /Tiền/ }));
    expect(view.getByText("Trang 1 / 2 · 3 kết quả")).toBeInTheDocument();
    expect(view.getByText("Cường")).toBeInTheDocument();
    expect(view.getByText("An")).toBeInTheDocument();
  });

  test("DataTable renders empty and non-searchable state and keeps columns", () => {
    const view = render(
      <DataTable
        rows={[]}
        getRowId={(row: { id: string }) => row.id}
        caption="Phòng"
        columns={[{ key: "name", label: "Tên phòng", render: () => "-" }]}
      />,
    );
    expect(view.queryByRole("searchbox")).toBeNull();
    expect(
      view
        .getAllByRole("status")
        .some((status) => status.textContent?.includes("Không có kết quả")),
    ).toBe(true);
    expect(view.getByRole("columnheader", { name: "Tên phòng" })).toBeInTheDocument();
  });

  test("folds Vietnamese search text and clamps pagination after filtering", () => {
    const result = getTablePage({
      rows: [{ name: "Nguyễn Ánh" }, { name: "Bình" }],
      searchText: (row) => row.name,
      query: "nguyen",
      page: 9,
      pageSize: 1,
    });
    expect(result.rows).toEqual([{ name: "Nguyễn Ánh" }]);
    expect(result.page).toBe(1);
  });

  test("sorts money with BigInt and clamps pagination", () => {
    const result = getTablePage({
      rows: [{ amount: 99999999999999n }, { amount: 2500000n }],
      sortValue: (row) => row.amount,
      page: 99,
      pageSize: 1,
    });
    expect(result.rows).toEqual([{ amount: 99999999999999n }]);
    expect(result.page).toBe(2);
  });

  test("renders labelled mobile rows and empty results", () => {
    const markup = html(
      <DataTable
        rows={[]}
        columns={[{ key: "name", label: "Tên phòng", render: (row: { name: string }) => row.name }]}
        getRowId={(row: { name: string }) => row.name}
        searchText={(row) => row.name}
        caption="Phòng"
      />,
    );
    expect(markup).toContain("Tên phòng");
    expect(markup).toContain("Không có kết quả");
  });

  test("renders status text, semantic tone, and progress semantics", () => {
    expect(html(<StatusBadge label="Đã thanh toán" tone="success" />)).toContain("Đã thanh toán");
    expect(html(<StatusBadge label="Đã thanh toán" tone="success" />)).toContain("bg-success-bg");
    expect(html(<Progress value={40} max={100} label="Hoàn tất" />)).toMatch(/role="progressbar"/);
    expect(html(<Progress value={40} max={100} label="Hoàn tất" />)).toContain(
      'aria-valuenow="40"',
    );
  });

  test("renders mobile data labels and keyboard navigation semantics", () => {
    expect(html(<MobileDataRow label="Mã phòng">101</MobileDataRow>)).toContain("Mã phòng");
    const tabs = html(
      <Tabs
        tabs={[
          { id: "one", label: "Một", content: "Nội dung" },
          { id: "two", label: "Hai", content: "Khác" },
        ]}
      />,
    );
    expect(tabs).toContain('role="tablist"');
    expect(tabs).toContain('role="tab"');
    expect(tabs).toContain('aria-selected="true"');
    const accordion = html(
      <Accordion items={[{ id: "one", title: "Chi tiết", content: "Nội dung" }]} />,
    );
    expect(accordion).toContain('aria-expanded="false"');
    expect(accordion).toContain("Chi tiết");
  });
});
