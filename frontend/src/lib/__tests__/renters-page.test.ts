import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Renters from "@/app/(manager)/renters/page";
import RenterDetail from "@/app/(manager)/renters/[renterId]/page";
import { ToastProvider } from "@/components/ui/toast";
import { MOTEL, MOTEL_WITHOUT_EXTRAS, ROOM, RENTERS, RENTER, RENTER_DETAIL, RENTER_DETAIL_WITHOUT_HISTORY } from "@/lib/api/__tests__/fixtures";
import type { RenterDetailResponse, RenterResponse } from "@/lib/api/types";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "manager_session=valid" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
afterEach(() => vi.unstubAllGlobals());
function reads(renters: RenterResponse[] = RENTERS, detail: RenterDetailResponse = RENTER_DETAIL_WITHOUT_HISTORY) {
  const fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/motels")) return Response.json([MOTEL, MOTEL_WITHOUT_EXTRAS]);
    if (path.endsWith("/rooms")) return Response.json([ROOM]);
    if (path.endsWith("/renters")) return Response.json(renters);
    if (path.includes("/renters/")) return Response.json(detail);
    throw new Error(`Unexpected read ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
function html(page: Awaited<ReturnType<typeof Renters>>) { return renderToStaticMarkup(createElement(ToastProvider, null, page)); }
async function detailPage(detail = RENTER_DETAIL_WITHOUT_HISTORY, params: Record<string, string> = {}) {
  const fetchMock = reads(RENTERS, detail);
  const page = await RenterDetail({ params: Promise.resolve({ renterId: detail.id }), searchParams: Promise.resolve({ motel: MOTEL.id, ...params }) });
  return { markup: html(page), fetchMock };
}
describe("M4 renter list", () => {
  it("renders named rooms, formatted contacts, separate tenancy/OA status and honest absent start dates", async () => {
    const fetchMock = reads();
    const markup = html(await Renters({ searchParams: Promise.resolve({ motel: MOTEL.id }) }));
    for (const value of ["Họ tên", "SĐT", "Số CCCD", "Phòng", "Trạng thái Zalo OA", "Ngày bắt đầu", RENTER.name, "+84 901 234 567", ROOM.name, "Đã follow", "Chưa follow", "Đang thuê", "Đã kết thức hợp đồng", "Chưa cập nhật", "Chưa xếp phòng", "Sao chép SĐT"]) expect(markup).toContain(value);
    expect(markup).toContain(`/renters/${RENTER.id}?motel=${MOTEL.id}`);
    expect(markup).not.toContain("05/09/2026");
    expect(markup).toContain("Thêm khách thuê");
    expect(markup).toContain(`aria-label="Chỉnh sửa ${RENTER.name}"`);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("passes roomId to the scoped read and preserves it in detail navigation", async () => {
    const fetchMock = reads([RENTER]);
    const markup = html(await Renters({ searchParams: Promise.resolve({ motel: MOTEL.id, roomId: ROOM.id }) }));
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith(`/renters?roomId=${ROOM.id}`))).toBe(true);
    expect(markup).toContain(`/renters/${RENTER.id}?motel=${MOTEL.id}&amp;roomId=${ROOM.id}`);
  });
  it("distinguishes empty motel from an empty room filter and offers a scoped return", async () => {
    reads([]);
    expect(html(await Renters({ searchParams: Promise.resolve({ motel: MOTEL.id }) }))).toContain("Chưa có khách thuê");
    reads([]);
    const markup = html(await Renters({ searchParams: Promise.resolve({ motel: MOTEL.id, roomId: ROOM.id }) }));
    expect(markup).toContain("Chưa có khách thuê trong phòng này");
    expect(markup).toContain(`/renters?motel=${MOTEL.id}`);
  });
  it("opens an accessible create form from the overview's create query", async () => {
    reads([]);
    const markup = html(await Renters({ searchParams: Promise.resolve({ motel: MOTEL.id, create: "1" }) }));
    expect(markup).toContain("Thông tin khách thuê");
    expect(markup).toContain("Họ tên");
    expect(markup).toContain("Số điện thoại");
    expect(markup).toContain("Chưa xếp phòng");
    expect(markup).not.toContain("type=\"file\"");
  });
  it("offers motel creation with no motel-scoped reads when no motel exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([])); vi.stubGlobal("fetch", fetchMock);
    expect(html(await Renters({ searchParams: Promise.resolve({}) }))).toContain("Tạo nhà trọ");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects foreign motel before reading renter data", async () => {
    const fetchMock = reads();
    await expect(Renters({ searchParams: Promise.resolve({ motel: "foreign" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
describe("M4 renter detail", () => {
  it("renders null contract, empty history and missing CCCD sides without fabricated content", async () => {
    const { markup } = await detailPage();
    expect(markup).toContain(RENTER_DETAIL_WITHOUT_HISTORY.name);
    expect(markup).toContain("Chưa có hợp đồng đang hiệu lực");
    expect(markup).toContain("Chưa có hóa đơn");
    expect(markup).toContain("CCCD mặt trước: Chưa cập nhật");
    expect(markup).toContain("CCCD mặt sau: Chưa cập nhật");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("Tạo magic link");
    expect(markup).not.toMatch(/Gửi Zalo|Tiền cọc|Hạn thanh toán/);
  });
  it("renders real contract calendar dates and invoice amounts/statuses only from the detail DTO", async () => {
    const { markup } = await detailPage({ ...RENTER_DETAIL, idCardFrontUrl: "https://images.example/front.jpg" }, { roomId: ROOM.id });
    for (const value of ["01/09/2026", "31/08/2027", "3.500.000 ₫", "3.740.000 ₫", "Đã thanh toán", "Quá hạn", ROOM.name]) expect(markup).toContain(value);
    expect(markup).toContain('alt="CCCD mặt trước của Trần Thị B"');
    expect(markup).toContain('src="https://images.example/front.jpg"');
    expect(markup).not.toContain('alt="CCCD mặt sau');
    expect(markup).toContain(`/renters?motel=${MOTEL.id}&amp;roomId=${ROOM.id}`);
  });
  it("keeps contract and invoice amounts in nonwrapping monetary elements", async () => {
    const { markup } = await detailPage(RENTER_DETAIL);
    const amounts = [...markup.matchAll(/<(dd|p) class="([^"]*)">(?:3\.500\.000|3\.740\.000) ₫<\/(?:dd|p)>/g)];
    expect(amounts.length).toBeGreaterThanOrEqual(2);
    for (const amount of amounts) expect(amount[2]).toContain("whitespace-nowrap");
  });
  it("displays both provided image sides with no referrer or optimization proxy", async () => {
    const { markup } = await detailPage({ ...RENTER_DETAIL_WITHOUT_HISTORY, idCardFrontUrl: "https://images.example/front.jpg", idCardBackUrl: "https://images.example/back.jpg" });
    expect(markup.match(/<img /g)).toHaveLength(2);
    expect(markup.match(/referrerPolicy="no-referrer"/g)).toHaveLength(2);
    expect(markup).not.toContain("/_next/image");
  });
  it("does not render unsafe URL schemes as CCCD images", async () => {
    const { markup } = await detailPage({ ...RENTER_DETAIL_WITHOUT_HISTORY, idCardFrontUrl: "javascript:alert(1)", idCardBackUrl: "//evil.example/back.jpg" });
    expect(markup).not.toContain("<img");
    expect(markup).toContain("Chưa cập nhật");
  });
  it("accepts root-relative images while leaving storage keys unresolved", async () => {
    const { markup } = await detailPage({ ...RENTER_DETAIL_WITHOUT_HISTORY, idCardFrontUrl: "/documents/front.jpg", idCardBackUrl: "renters/back.jpg" });
    expect(markup).toContain('src="/documents/front.jpg"');
    expect(markup.match(/<img /g)).toHaveLength(1);
    expect(markup).toContain("CCCD mặt sau: Chưa cập nhật");
  });
  it("does not render malformed remote URLs or embedded credentials", async () => {
    const { markup } = await detailPage({ ...RENTER_DETAIL_WITHOUT_HISTORY, idCardFrontUrl: "https://", idCardBackUrl: "https://private:secret@images.example/back.jpg" });
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("private:secret");
  });
  it("routes a missing renter to the manager not-found screen", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new URL(url).pathname.endsWith("/motels") ? Response.json([MOTEL]) : Response.json({ error: "Không tìm thấy", code: "NOT_FOUND" }, { status: 404 })));
    await expect(RenterDetail({ params: Promise.resolve({ renterId: "missing" }), searchParams: Promise.resolve({ motel: MOTEL.id }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
