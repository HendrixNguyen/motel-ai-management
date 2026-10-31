import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LedgerRow from "@/components/ui/ledger-row";
import PageHeader from "@/components/ui/page-header";

describe("shared presentation primitives", () => {
  test("keeps long ledger content readable on narrow screens", () => {
    const html = renderToStaticMarkup(
      <LedgerRow
        title="Phòng có tên dài không được cắt"
        detail="Hóa đơn tháng 10"
        value="3.500.000 ₫"
      />,
    );
    expect(html).toContain("Phòng có tên dài không được cắt");
    expect(html).toContain("Hóa đơn tháng 10");
    expect(html).toContain("3.500.000 ₫");
    expect(html).toContain("min-w-0");
    expect(html).toContain("break-words");
  });

  test("wraps page actions instead of forcing a narrow viewport wider", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Phòng" actions={<button>Thêm phòng</button>} />,
    );
    expect(html).toContain("flex-wrap");
    expect(html).not.toContain("shrink-0 flex-wrap");
  });
});
