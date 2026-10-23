import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Field from "@/components/ui/field";
import PageHeader from "@/components/ui/page-header";
import { ToastProvider } from "@/components/ui/toast";
import Sidebar from "@/components/manager/sidebar";
import TopBar from "@/components/manager/top-bar";
import AppShell from "@/components/ui/app-shell";
import ManagerShell from "@/components/ui/manager-shell";
import PortalShell from "@/components/ui/portal-shell";
import MotelSwitcher from "@/components/ui/motel-switcher";
import BottomNav from "@/components/ui/bottom-nav";
import LoginPage from "@/app/(auth)/login/page";
import { MANAGER_ME, MOTEL, MOTEL_WITHOUT_EXTRAS } from "@test/lib/api/fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/rooms",
  useSearchParams: () => new URLSearchParams(`motel=${MOTEL_WITHOUT_EXTRAS.id}`),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("accessible shell controls", () => {
  it("joins a field error to the labelled control", () => {
    const html = renderToStaticMarkup(
      Field({
        id: "email",
        label: "Email",
        error: "Nhập email hợp lệ",
        children: (props) => createElement("input", props),
      }),
    );
    expect(html).toContain('<label for="email"');
    expect(html).toContain('id="email"');
    expect(html).toContain('aria-describedby="email-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="email-error"');
    expect(html).toContain("Nhập email hợp lệ");
  });
  it("renders the login fields with password-manager semantics", () => {
    const html = renderToStaticMarkup(createElement(LoginPage));
    expect(html).toContain('for="email"');
    expect(html).toContain('for="password"');
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('type="password"');
    expect(html).toContain("Đăng nhập");
  });
  it("composes shell primitives with safe-area content and fixed navigation semantics", () => {
    const html = renderToStaticMarkup(
      createElement(
        AppShell as React.ElementType,
        {
          sidebar: createElement("aside", null, "side"),
          bottomNav: createElement("nav", null, "bottom"),
        },
        createElement("main", null, "content"),
      ),
    );
    expect(html).toContain("side");
    expect(html).toContain("bottom");
    expect(html).toContain("content");
    expect(html).toContain("shell-safe-area");
  });
  it("manager shell lets page content use full viewport width", () => {
    const html = renderToStaticMarkup(
      createElement(
        ManagerShell as React.ElementType,
        { sidebar: createElement("aside"), header: createElement("header") },
        createElement("section", null, "manager"),
      ),
    );
    expect(html).toContain('class="motion-safe:animate-[page-enter_160ms_ease-out_both] w-full');
    expect(html).not.toContain("max-w-7xl");
  });

  it("composes manager and portal shells without owning route data", () => {
    expect(
      renderToStaticMarkup(
        createElement(
          ManagerShell as React.ElementType,
          { sidebar: createElement("aside"), header: createElement("header") },
          createElement("main", null, "manager"),
        ),
      ),
    ).toContain("manager");
    expect(
      renderToStaticMarkup(
        createElement(
          PortalShell as React.ElementType,
          { header: createElement("header") },
          createElement("main", null, "portal"),
        ),
      ),
    ).toContain("portal");
  });
  it("renders motel switcher and bottom nav as accessible compositions", () => {
    expect(
      renderToStaticMarkup(
        createElement(MotelSwitcher, { motels: [MOTEL], selectedId: MOTEL.id, onChange: () => {} }),
      ),
    ).toContain('for="motel-selector-button"');
    expect(
      renderToStaticMarkup(
        createElement(
          BottomNav as React.ElementType,
          null,
          createElement("a", { href: "/" }, "Trang chủ"),
        ),
      ),
    ).toContain("Trang chủ");
  });
  it("keeps compact billing navigation scoped and fully labelled while desktop keeps full text", () => {
    const html = renderToStaticMarkup(createElement(Sidebar));
    const compactNav = html.match(
      /<div aria-label="Điều hướng gọn trên điện thoại"[^>]*>([\s\S]*?)<\/nav>/,
    )?.[1];
    expect(compactNav).toBeDefined();
    expect(compactNav).toContain(`href="/billing?motel=${MOTEL_WITHOUT_EXTRAS.id}"`);
    expect(compactNav).toContain(`href="/contracts?motel=${MOTEL_WITHOUT_EXTRAS.id}"`);
    expect(compactNav).toContain('aria-label="Tính tiền &amp; Hóa đơn"');
    expect(compactNav).toContain(">Hóa đơn<");
    expect(html).toMatch(
      /<nav aria-label="Điều hướng chính"[\s\S]*?Tính tiền &amp; Hóa đơn[\s\S]*?<\/nav>/,
    );
    expect(html).toContain('class="fixed inset-x-0 bottom-0');
  });
  it("renders five primary mobile destinations, a scoped More route, and all six desktop destinations", () => {
    const html = renderToStaticMarkup(createElement(Sidebar));
    for (const path of ["/", "/motels", "/rooms", "/renters", "/billing"]) {
      expect(html).toContain(`href="${path}?motel=${MOTEL_WITHOUT_EXTRAS.id}"`);
    }
    expect(html.match(/href="[^\"]+\?motel=/g) ?? []).toHaveLength(12);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-label="Điều hướng chính trên điện thoại"');
    expect(html).toContain('aria-label="Điều hướng gọn trên điện thoại"');
    expect(html).toContain('aria-label="Thêm, các mục khác"');
    expect(html).toContain('aria-controls="manager-more-routes"');
    expect(html).toContain('aria-label="Các mục khác"');
  });
  it("uses the URL motel selection and renders labelled account controls", () => {
    const html = renderToStaticMarkup(
      createElement(TopBar, { manager: MANAGER_ME, motels: [MOTEL, MOTEL_WITHOUT_EXTRAS] }),
    );
    expect(html).toContain('for="motel-selector"');
    expect(html).toContain('for="motel-selector-button"');
    expect(html).toContain(MOTEL_WITHOUT_EXTRAS.name);
    expect(html).toContain(MANAGER_ME.email);
    expect(html).toContain("Menu phụ");
    expect(html).toContain("Đăng xuất");
    expect(html).toMatch(
      /<button[^>]*aria-label="Menu phụ, Tài khoản"[^>]*aria-expanded="false"[^>]*aria-controls="manager-account-menu"/,
    );
    expect(html).toMatch(
      /<div[^>]*id="manager-account-menu"[^>]*role="group"[^>]*aria-label="Tùy chọn tài khoản"/,
    );
    expect(html).not.toContain('href="/contracts?');
  });
  it("renders shared page header actions and toast adapter", () => {
    const html = renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(PageHeader, {
          title: "Tổng quan",
          description: "Hôm nay",
          actions: createElement("button", null, "Tạo"),
        }),
      ),
    );
    expect(html).toContain("Tổng quan");
    expect(html).toContain("Hôm nay");
    expect(html).toContain("Tạo");
    expect(html).toContain('aria-live="polite"');
  });
  it("disables the motel selector when no motel exists", () => {
    const html = renderToStaticMarkup(createElement(TopBar, { manager: MANAGER_ME, motels: [] }));
    expect(html).toContain('disabled=""');
    expect(html).toContain("Chưa có nhà trọ");
  });
});
