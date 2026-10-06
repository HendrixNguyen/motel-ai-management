import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Rooms from "@/app/(manager)/rooms/page";
import { ToastProvider } from "@/components/ui/toast";
import { MOTEL, MOTEL_WITHOUT_EXTRAS, ROOM, ROOM_WITHOUT_FLOOR, RENTER, RENTER_WITHOUT_ROOM } from "@/lib/api/__tests__/fixtures";
import type { RoomResponse, RenterResponse } from "@/lib/api/types";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "manager_session=valid" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }), notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
afterEach(() => vi.unstubAllGlobals());

async function markup(params: Record<string, string | string[]> = {}, rooms: RoomResponse[] = [ROOM, ROOM_WITHOUT_FLOOR], renters: RenterResponse[] = [RENTER, RENTER_WITHOUT_ROOM]) {
  const fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path === "/api/manager/motels") return Response.json([MOTEL, MOTEL_WITHOUT_EXTRAS]);
    if (path === `/api/manager/motels/${MOTEL.id}/rooms`) return Response.json(rooms);
    if (path === `/api/manager/motels/${MOTEL.id}/renters`) return Response.json(renters);
    throw new Error(`Unexpected read: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const page = await Rooms({ searchParams: Promise.resolve(params) });
  return { html: renderToStaticMarkup(createElement(ToastProvider, null, page)), fetchMock };
}

describe("M3 room management", () => {
  it("renders base rent, nullable floor, labelled statuses and current renter contact with one joined read", async () => {
    const { html, fetchMock } = await markup();
    expect(html).toContain("P.101");
    expect(html).toContain("3.500.000 ₫");
    expect(html).toContain("Giá thuê cơ bản");
    expect(html).toContain("Tầng 1");
    expect(html).toContain("Chưa ghi tầng");
    expect(html).toContain("Đang ở");
    expect(html).toContain("Trống");
    expect(html).toContain(RENTER.name);
    expect(html).toContain(RENTER.phone);
    expect(html).not.toContain(RENTER_WITHOUT_ROOM.name);
    expect(html).toContain(`/renters?motel=${MOTEL.id}&amp;roomId=${ROOM.id}`);
    expect(html).toContain(`Chỉnh sửa ${ROOM.name}`);
    expect(html).toContain(`Đổi trạng thái ${ROOM.name}`);
    expect(html).not.toMatch(/Quá hạn|Lịch sử chỉ số|Tiện nghi/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("keeps every active roommate while excluding inactive and foreign-motel assignments", async () => {
    const { html } = await markup({}, [ROOM], [RENTER,
      { ...RENTER, id: "roommate", name: "Nguyễn An", phone: "84900000000" },
      { ...RENTER, id: "inactive", name: "Khách cũ", status: "inactive" },
      { ...RENTER, id: "foreign", name: "Khách nhà khác", motelId: MOTEL_WITHOUT_EXTRAS.id },
    ]);
    expect(html).toContain(RENTER.name);
    expect(html).toContain("Nguyễn An");
    expect(html).toContain("84900000000");
    expect(html).not.toContain("Khách cũ");
    expect(html).not.toContain("Khách nhà khác");
  });
  it("passes URL filters including floor zero to the scoped RSC read and displays their values", async () => {
    const { html, fetchMock } = await markup({ motel: MOTEL.id, floor: "0", status: "maintenance", search: "P.001" });
    const urls = fetchMock.mock.calls.map(([url]) => new URL(url));
    const roomRead = urls.find((url) => url.pathname.endsWith("/rooms"))!;
    expect(roomRead.search).toBe("?floor=0&status=maintenance&search=P.001");
    expect(html).toContain('value="0"');
    expect(html).toContain('value="P.001"');
    expect(html).toContain('value="maintenance" selected=""');
    expect(html).toContain("Xóa bộ lọc");
  });
  it("offers room creation on an unfiltered empty motel and clearing filters on an empty result", async () => {
    const empty = await markup({}, []);
    expect(empty.html).toContain("Chưa có phòng trọ");
    expect(empty.html).toContain("Thêm phòng");
    const filtered = await markup({ status: "maintenance" }, []);
    expect(filtered.html).toContain("Không có phòng phù hợp");
    expect(filtered.html).toContain(`/rooms?motel=${MOTEL.id}`);
  });
  it("offers motel creation without scoped reads when no motel exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal("fetch", fetchMock);
    const page = await Rooms({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(createElement(ToastProvider, null, page));
    expect(html).toContain("Chưa có nhà trọ");
    expect(html).toContain("Tạo nhà trọ");
    expect(html).not.toContain("Thêm phòng");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects foreign scope before rooms or renters are read", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([MOTEL]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(Rooms({ searchParams: Promise.resolve({ motel: "foreign" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("lets a failed renter read reach the error boundary instead of implying rooms have no renters", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/motels")) return Response.json([MOTEL]);
      if (path.endsWith("/rooms")) return Response.json([ROOM]);
      return Response.json({ error: "private driver error", code: "INTERNAL_ERROR" }, { status: 500 });
    }));
    await expect(Rooms({ searchParams: Promise.resolve({}) })).rejects.toThrow("Đã xảy ra lỗi hệ thống");
  });
});
