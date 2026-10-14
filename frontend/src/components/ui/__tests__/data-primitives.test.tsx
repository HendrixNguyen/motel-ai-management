import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DataTable from "../data-table";
import StatusBadge from "../status-badge";
import Progress from "../progress";
import MobileDataRow from "../mobile-data-row";
import Tabs from "../tabs";
import Accordion from "../accordion";
import { getTablePage } from "../table-model";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("data display and navigation primitives", () => {
  test("folds Vietnamese search text and clamps pagination after filtering", () => {
    const result = getTablePage({ rows: [{ name: "Nguyễn Ánh" }, { name: "Bình" }], searchText: (row) => row.name, query: "nguyen", page: 9, pageSize: 1 });
    expect(result.rows).toEqual([{ name: "Nguyễn Ánh" }]);
    expect(result.page).toBe(1);
  });

  test("sorts money with BigInt and clamps pagination", () => {
    const result = getTablePage({ rows: [{ amount: 99999999999999n }, { amount: 2500000n }], sortValue: (row) => row.amount, page: 99, pageSize: 1 });
    expect(result.rows).toEqual([{ amount: 99999999999999n }]);
    expect(result.page).toBe(2);
  });

  test("renders labelled mobile rows and empty results", () => {
    const markup = html(<DataTable rows={[]} columns={[{ key: "name", label: "Tên phòng", render: (row: { name: string }) => row.name }]} getRowId={(row: { name: string }) => row.name} searchText={(row) => row.name} caption="Phòng" />);
    expect(markup).toContain("Tên phòng");
    expect(markup).toContain("Không có kết quả");
  });

  test("renders status text, semantic tone, and progress semantics", () => {
    expect(html(<StatusBadge label="Đã thanh toán" tone="success" />)).toContain("Đã thanh toán");
    expect(html(<StatusBadge label="Đã thanh toán" tone="success" />)).toContain("bg-success-bg");
    expect(html(<Progress value={40} max={100} label="Hoàn tất" />)).toMatch(/role="progressbar"/);
    expect(html(<Progress value={40} max={100} label="Hoàn tất" />)).toContain('aria-valuenow="40"');
  });

  test("renders mobile data labels and keyboard navigation semantics", () => {
    expect(html(<MobileDataRow label="Mã phòng">101</MobileDataRow>)).toContain("Mã phòng");
    const tabs = html(<Tabs tabs={[{ id: "one", label: "Một", content: "Nội dung" }, { id: "two", label: "Hai", content: "Khác" }]} />);
    expect(tabs).toContain('role="tablist"');
    expect(tabs).toContain('role="tab"');
    expect(tabs).toContain('aria-selected="true"');
    const accordion = html(<Accordion items={[{ id: "one", title: "Chi tiết", content: "Nội dung" }]} />);
    expect(accordion).toContain('aria-expanded="false"');
    expect(accordion).toContain("Chi tiết");
  });
});
