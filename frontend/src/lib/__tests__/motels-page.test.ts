import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Motels from "@/app/(manager)/motels/page";
import { ToastProvider } from "@/components/ui/toast";
import { MOTEL, MOTEL_WITHOUT_EXTRAS, ROOMS } from "@/lib/api/__tests__/fixtures";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "manager_session=valid" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
afterEach(() => vi.unstubAllGlobals());

async function markup(motels = [MOTEL, MOTEL_WITHOUT_EXTRAS]) {
  const fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path === "/api/manager/motels") return Response.json(motels);
    if (path === `/api/manager/motels/${MOTEL.id}/rooms`) return Response.json(ROOMS);
    if (path === `/api/manager/motels/${MOTEL_WITHOUT_EXTRAS.id}/rooms`) return Response.json([]);
    throw new Error(`Unexpected read: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const page = await Motels({ searchParams: Promise.resolve({}) });
  return { html: renderToStaticMarkup(createElement(ToastProvider, null, page)), fetchMock };
}

describe("M2 server-rendered motel grid", () => {
  it("renders every owned motel with real room counts, formatted prices and bank owner", async () => {
    const { html, fetchMock } = await markup();
    expect(html).toContain(MOTEL.name);
    expect(html).toContain(MOTEL.address);
    expect(html).toContain("2 phòng");
    expect(html).toContain("0 phòng");
    expect(html).toContain("3.500 ₫");
    expect(html).toContain("15.000 ₫");
    expect(html).toContain("NGUYEN VAN MINH");
    expect(html).toContain("Chưa có địa chỉ");
    expect(html).toContain("Chưa thiết lập");
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => new URL(url).pathname)).toContain(`/api/manager/motels/${MOTEL_WITHOUT_EXTRAS.id}/rooms`);
  });
  it("offers creation before any rooms read when the manager owns no motels", async () => {
    const { html, fetchMock } = await markup([]);
    expect(html).toContain("Chưa có nhà trọ");
    expect(html).toContain("bấm Tạo nhà trọ để bắt đầu");
    expect(html).toContain("Tạo nhà trọ");
    expect(html).not.toContain("<article");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not present a failed room count as zero", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new URL(url).pathname === "/api/manager/motels"
      ? Response.json([MOTEL])
      : Response.json({ error: "Lỗi máy chủ", code: "INTERNAL_ERROR" }, { status: 500 })));
    await expect(Motels({ searchParams: Promise.resolve({}) })).rejects.toThrow("Đã xảy ra lỗi hệ thống");
  });
  it("rejects a foreign selector value before reading any motel rooms", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([MOTEL]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(Motels({ searchParams: Promise.resolve({ motel: "foreign" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
