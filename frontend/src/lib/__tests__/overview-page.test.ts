import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Overview from "@/app/(manager)/page";
import { ToastProvider } from "@/components/ui/toast";
import { MOTEL, MOTEL_WITHOUT_EXTRAS, ROOM } from "@/lib/api/__tests__/fixtures";
import type { MotelResponse, RoomResponse, RoomStatus } from "@/lib/api/types";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "manager_session=valid" }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: () => { throw new Error("NEXT_REDIRECT"); },
}));
afterEach(() => vi.unstubAllGlobals());

function roomsWithStatuses(statuses: RoomStatus[], motelId = MOTEL.id): RoomResponse[] {
  return statuses.map((status, index) => ({ ...ROOM, id: `room-${index}`, motelId, status }));
}

async function markup(params: Record<string, string | string[]> = {}, rooms: RoomResponse[] = roomsWithStatuses(["occupied", "available", "maintenance"]), motels: MotelResponse[] = [MOTEL, MOTEL_WITHOUT_EXTRAS]) {
  const motelId = typeof params.motel === "string" ? params.motel : motels[0]?.id;
  const fetchMock = vi.fn(async (url: string) => {
    const { pathname, search } = new URL(url);
    if (pathname === "/api/manager/motels") return Response.json(motels);
    if (pathname === `/api/manager/motels/${motelId}/rooms` && search === "") return Response.json(rooms);
    if (pathname === `/api/manager/motels/${motelId}/renters` && search === "") return Response.json([]);
    if (pathname === `/api/manager/motels/${motelId}/billing/periods` && search === "") return Response.json([]);
    throw new Error(`Unexpected read: ${pathname}${search}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const page = await Overview({ searchParams: Promise.resolve(params) });
  return { html: renderToStaticMarkup(createElement(ToastProvider, null, page)), fetchMock };
}

describe("M1 overview", () => {
  it("summarizes every room status from an unfiltered read and offers only the live renter quick action", async () => {
    const { html, fetchMock } = await markup({ status: "available", floor: "0", search: "P.101" }, roomsWithStatuses(["occupied", "occupied", "available", "maintenance"]));
    expect(html).toContain("Tổng quan");
    expect(html).toContain("Phòng đang thuê");
    expect(html).toContain("2/4");
    expect(html).toContain("Phòng trống");
    expect(html).toContain("Tỷ lệ lấp đầy 50%");
    expect(html).toContain(`href="/renters?create=1&amp;motel=${MOTEL.id}"`);
    expect(html).toContain("Thêm khách thuê");
    expect(html).toContain("Nhập chỉ số điện nước");
    expect(html).toContain("Hóa đơn chưa thanh toán");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each([
    { statuses: ["occupied", "available", "maintenance"], occupancy: "33%" },
    { statuses: ["occupied", "occupied", "maintenance"], occupancy: "67%" },
    { statuses: ["occupied", "occupied"], occupancy: "100%" },
    { statuses: ["available", "maintenance"], occupancy: "0%" },
  ] satisfies { statuses: RoomStatus[]; occupancy: string }[])("calculates occupied / all rooms and rounds to $occupancy for $statuses", async ({ statuses, occupancy }) => {
    const { html } = await markup({}, roomsWithStatuses(statuses));
    expect(html).toContain(`Tỷ lệ lấp đầy ${occupancy}`);
  });

  it("reads the explicitly selected owned motel and carries its scope into the renter destination", async () => {
    const { html, fetchMock } = await markup({ motel: MOTEL_WITHOUT_EXTRAS.id }, roomsWithStatuses(["maintenance"], MOTEL_WITHOUT_EXTRAS.id));
    expect(html).toContain("0/1");
    expect(html).toContain("Tỷ lệ lấp đầy 0%");
    expect(html).toContain(`href="/renters?create=1&amp;motel=${MOTEL_WITHOUT_EXTRAS.id}"`);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("shows honest zero room counts with useful guidance and finite occupancy for an empty motel", async () => {
    const { html } = await markup({}, []);
    expect(html).toContain("0/0");
    expect(html).toContain("Tỷ lệ lấp đầy 0%");
    expect(html).toContain("Chưa có phòng trọ");
    expect(html).toContain(`href="/rooms?motel=${MOTEL.id}"`);
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("offers motel creation without room statistics or scoped reads when no motel exists", async () => {
    const { html, fetchMock } = await markup({}, [], []);
    expect(html).toContain("Chưa có nhà trọ");
    expect(html).toContain("Tạo nhà trọ");
    expect(html).not.toMatch(/Tỷ lệ lấp đầy|đang thuê|Thêm khách thuê/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["foreign", "", [MOTEL.id, MOTEL_WITHOUT_EXTRAS.id]])("rejects invalid motel scope %j before reading rooms", async (motel) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([MOTEL]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(Overview({ searchParams: Promise.resolve({ motel }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets a failed room read reach the error boundary instead of reporting zero rooms", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new URL(url).pathname.endsWith("/motels")
      ? Response.json([MOTEL])
      : Response.json({ error: "private driver error", code: "INTERNAL_ERROR" }, { status: 500 })));
    await expect(Overview({ searchParams: Promise.resolve({}) })).rejects.toThrow("Đã xảy ra lỗi hệ thống");
  });
});
