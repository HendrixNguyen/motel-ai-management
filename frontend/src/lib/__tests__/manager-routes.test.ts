import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Overview from "@/app/(manager)/page";
import Motels from "@/app/(manager)/motels/page";
import Rooms from "@/app/(manager)/rooms/page";
import Renters from "@/app/(manager)/renters/page";
import ErrorPage from "@/app/(manager)/error";
import Loading from "@/app/(manager)/loading";
import NotFound from "@/app/(manager)/not-found";
import Button from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { MOTEL, ROOMS } from "@/lib/api/__tests__/fixtures";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "manager_session=valid" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => Response.json(new URL(url).pathname.endsWith("/rooms") ? ROOMS : [MOTEL]));
});

describe("manager route frames", () => {
  for (const [Page, heading] of [[Overview, "Tổng quan"], [Motels, "Nhà trọ"], [Rooms, "Phòng trọ"], [Renters, "Khách thuê"]] as const) {
    it(`makes ${heading} reachable within the manager shell`, async () => {
      const page = await Page({ searchParams: Promise.resolve({ motel: MOTEL.id }) });
      const html = renderToStaticMarkup(createElement(ToastProvider, null, page));
      expect(html).toContain(heading);
      expect(html).toContain("<h1");
    });
    it(`validates motel ownership before rendering ${heading}`, async () => {
      await expect(Page({ searchParams: Promise.resolve({ motel: "foreign" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    });
  }
});

describe("manager fallback states", () => {
  it("offers retry without rendering raw error details", () => {
    const retry = vi.fn();
    const ui = ErrorPage({ error: new Error("secret database address"), retry });
    const html = renderToStaticMarkup(ui);
    expect(html).toContain("Không thể tải nội dung");
    expect(html).toContain("Thử lại");
    expect(html).not.toContain("secret database address");
    // Exercise our button callback directly; the browser runner covers its DOM interaction.
    const action = ui.props.children.find((child: { type?: unknown }) => child.type === Button);
    const button = Button(action.props);
    button.props.onClick();
    expect(retry).toHaveBeenCalledOnce();
  });
  it("announces loading while skeleton shapes are hidden from assistive technology", () => {
    const html = renderToStaticMarkup(createElement(Loading));
    expect(html).toContain('role="status"');
    expect(html).toContain("Đang tải nội dung");
    expect(html).toContain('aria-hidden="true"');
  });
  it("offers a Vietnamese escape link for an unavailable route", () => {
    const html = renderToStaticMarkup(createElement(NotFound));
    expect(html).toContain("Không tìm thấy trang");
    expect(html).toContain('href="/"');
    expect(html).toContain("Về tổng quan");
  });
});
