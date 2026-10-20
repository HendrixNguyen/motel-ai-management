import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ listMotels: vi.fn(), listRooms: vi.fn(), listRenters: vi.fn(), listBillingPeriods: vi.fn(), listInvoices: vi.fn() }));
vi.mock("@/lib/api/motels", () => ({ listMotels: mocks.listMotels }));
vi.mock("@/lib/api/rooms", () => ({ listRooms: mocks.listRooms }));
vi.mock("@/lib/api/renters", () => ({ listRenters: mocks.listRenters }));
vi.mock("@/lib/api/billing", () => ({ listBillingPeriods: mocks.listBillingPeriods, listInvoices: mocks.listInvoices }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/manager/motel-editor", () => ({ default: () => <div>Chưa có nhà trọ</div> }));

import Overview from "./page";
import { ApiError } from "@/lib/api/client";

const motel = { id: "motel-a", managerId: "manager", name: "Nhà trọ A", address: null, electricityPrice: "3500", waterPrice: "15000", otherFees: [], bankAccount: null, createdAt: "2026-10-01T00:00:00Z" };
const room = (id: string, status: "occupied" | "available" | "maintenance") => ({ id, motelId: motel.id, name: id, basePrice: "3500000", floor: 1, status, createdAt: motel.createdAt });
const period = { id: "period-a", motelId: motel.id, month: 10, year: 2026, status: "sent" as const, createdAt: motel.createdAt };
const invoice = (id: string, paymentStatus: "unpaid" | "paid" | "overdue", totalAmount: string) => ({ id, billingPeriodId: period.id, roomId: id, roomName: `P.${id}`, renterId: id, motelId: motel.id, rentAmount: totalAmount, electricityUsage: "1", electricityCost: "0", waterUsage: "1", waterCost: "0", otherFees: [], totalAmount, qrCodeData: null, paymentStatus, paymentMethod: null, paidAt: null, createdAt: motel.createdAt });

beforeEach(() => {
  mocks.listMotels.mockResolvedValue([motel]);
  mocks.listRooms.mockResolvedValue([room("101", "occupied"), room("102", "occupied"), room("103", "available"), room("104", "maintenance")]);
  mocks.listRenters.mockResolvedValue([]);
  mocks.listBillingPeriods.mockResolvedValue([period]);
  mocks.listInvoices.mockResolvedValue([invoice("101", "unpaid", "9007199254740993"), invoice("102", "overdue", "700"), invoice("103", "paid", "500")]);
});
afterEach(() => vi.resetAllMocks());

const renderPage = (searchParams: Record<string, string> = {}) => Overview({ searchParams: Promise.resolve(searchParams) }).then((node) => renderToStaticMarkup(node));

describe("overview dashboard", () => {
  test("groups complete room counts and rounds occupancy including maintenance rooms", async () => {
    const html = await renderPage();
    expect(html).toContain("2/4");
    expect(html).toContain("Phòng trống");
    expect(html).toContain("1 bảo trì");
    expect(html).toContain("Tỷ lệ lấp đầy 50%");
  });

  test("shows distinct invoice payment states and excludes paid rows", async () => {
    const html = await renderPage();
    expect(html).toContain("Hóa đơn kỳ đang xử lý");
    expect(html).toContain("2 hóa đơn chưa thu · 1 chưa thanh toán · 1 quá hạn");
    expect(html).toContain("P.101");
    expect(html).toContain("P.102");
    expect(html).toContain("1 chưa thanh toán · 1 quá hạn");
    expect(html).not.toContain("Hóa đơn chưa thanh toán");
    expect(html).toContain("Quá hạn");
    expect(html).toContain("Chưa thanh toán");
    const overdueRow = html.slice(html.indexOf("P.102"), html.indexOf("P.103"));
    expect(overdueRow).toContain("Quá hạn");
    expect(overdueRow).not.toContain("Chưa thanh toán");
    const paidRow = html.slice(html.indexOf("P.103"));
    expect(paidRow).toContain("Đã thanh toán");
    expect(paidRow).not.toContain("hóa đơn chưa thu");
  });

  test("shows current invoices as ledger rows and does not claim ticket administration", async () => {
    const html = await renderPage();
    expect(html).toContain("P.101");
    expect(html).toContain("P.102");
    expect(html).not.toContain("Sự cố chưa xử lý");
    expect(html).not.toContain("Sự cố mới");
  });

  test("preserves selected motel on primary renter, capture, billing and room actions", async () => {
    const html = await renderPage({ motel: "motel-a" });
    expect(html).toContain('href="/renters?create=1&amp;motel=motel-a"');
    expect(html).toContain('href="/capture?motel=motel-a"');
    expect(html).toContain('href="/billing/period-a?motel=motel-a"');
    expect(html).toContain('href="/rooms?motel=motel-a"');
  });

  test("distinguishes missing motel, empty rooms, absent period and empty invoices", async () => {
    mocks.listMotels.mockResolvedValue([]);
    expect(await renderPage()).toContain("Chưa có nhà trọ");
    mocks.listMotels.mockResolvedValue([motel]);
    mocks.listRooms.mockResolvedValue([]);
    let html = await renderPage();
    expect(html).toContain("Chưa có phòng trọ");
    expect(html).toContain("Tỷ lệ lấp đầy 0%");
    mocks.listBillingPeriods.mockResolvedValue([]);
    html = await renderPage();
    expect(html).toContain("Chưa có kỳ hóa đơn");
    expect(html).not.toContain("9.007.199.254.741.693 ₫");
    mocks.listBillingPeriods.mockResolvedValue([period]);
    mocks.listInvoices.mockResolvedValue([]);
    expect(await renderPage()).toContain("Kỳ này chưa có hóa đơn");
  });

  test.each([
    new Error("private driver address: database.local"),
    new ApiError(500, "INTERNAL_ERROR", "Đã xảy ra lỗi hệ thống", { detail: "private stack" }),
    new ApiError(0, "INTERNAL_ERROR", "Network failure"),
    new ApiError(404, "NOT_FOUND", "Không tìm thấy nhà trọ"),
  ])("renders the same safe retry state for motel read failure %s", async (error) => {
    mocks.listMotels.mockRejectedValueOnce(error);
    const html = await renderPage();
    expect(html).toContain("Không thể tải danh sách nhà trọ");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("private driver address");
    expect(html).not.toContain("private stack");
    if (error instanceof ApiError && error.status < 500) expect(html).not.toContain(error.message);
  });

  test("propagates 401 motel errors for the server API auth redirect", async () => {
    const unauthorized = new ApiError(401, "UNAUTHORIZED", "Đăng nhập lại");
    mocks.listMotels.mockRejectedValueOnce(unauthorized);
    await expect(renderPage()).rejects.toBe(unauthorized);
  });

  test("does not label an old open period as current when newer period is closed", async () => {
    const oldDraft = { ...period, id: "old-draft", month: 10, status: "draft" as const };
    const newestClosed = { ...period, id: "closed-period", month: 11, status: "closed" as const };
    mocks.listBillingPeriods.mockResolvedValueOnce([newestClosed, oldDraft]);
    const html = await renderPage();
    expect(html).toContain("Chưa có kỳ hóa đơn");
    expect(html).not.toContain('href="/billing/old-draft/invoices?motel=motel-a"');
    expect(html).not.toContain('href="/billing/closed-period/invoices?motel=motel-a"');
  });

  test("shows the newest active draft and not an older sent period as current", async () => {
    const draft = { ...period, id: "draft-period", month: 11, status: "draft" as const };
    const sent = { ...period, id: "sent-period", month: 10, status: "sent" as const };
    mocks.listBillingPeriods.mockResolvedValueOnce([draft, sent]);
    const html = await renderPage();
    expect(html).toContain("Tháng 11/2026");
    expect(html).toContain('href="/billing/draft-period/invoices?motel=motel-a"');
    expect(html).not.toContain('href="/billing/sent-period/invoices?motel=motel-a"');
  });

  test("does not call a sent or closed period current when latest period is closed", async () => {
    const closed = { ...period, id: "closed-period", status: "closed" as const };
    const sent = { ...period, id: "sent-period", status: "sent" as const };
    mocks.listBillingPeriods.mockResolvedValueOnce([closed, sent]);
    const html = await renderPage();
    expect(html).toContain("Chưa có kỳ hóa đơn");
    expect(html).not.toContain("Hóa đơn kỳ đang xử lý");
    expect(html).not.toContain('href="/billing/closed-period/invoices?motel=motel-a"');
    expect(html).not.toContain('href="/billing/sent-period/invoices?motel=motel-a"');
  });

  test("does not call a closed latest period current when no active periods exist", async () => {
    const closed = { ...period, id: "closed-period", status: "closed" as const };
    mocks.listBillingPeriods.mockResolvedValueOnce([closed]);
    const html = await renderPage();
    expect(html).toContain("Chưa có kỳ hóa đơn");
    expect(html).not.toContain("Hóa đơn kỳ đang xử lý");
    expect(html).not.toContain('href="/billing/closed-period/invoices?motel=motel-a"');
  });

  test("routes failed room, renter, period and invoice reads to the shared error boundary", async () => {
    for (const [key, expected] of [["listRooms", "phòng"], ["listRenters", "khách thuê"], ["listBillingPeriods", "kỳ hóa đơn"], ["listInvoices", "hóa đơn"]] as const) {
      mocks[key].mockRejectedValueOnce(new Error(`Không thể tải ${expected}`));
      await expect(renderPage()).rejects.toThrow(`Không thể tải ${expected}`);
    }
  });
});
