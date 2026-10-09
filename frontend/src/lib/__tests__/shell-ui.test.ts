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
import { MANAGER_ME, MOTEL, MOTEL_WITHOUT_EXTRAS } from "@/lib/api/__tests__/fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/rooms",
  useSearchParams: () => new URLSearchParams(`motel=${MOTEL_WITHOUT_EXTRAS.id}`),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("accessible shell controls", () => {
  it("joins a field error to the labelled control", () => {
    const html = renderToStaticMarkup(Field({ id: "email", label: "Email", error: "Nhập email hợp lệ", children: (props) => createElement("input", props) }));
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
    const html = renderToStaticMarkup(createElement(AppShell, { sidebar: createElement("aside", null, "side"), bottomNav: createElement("nav", null, "bottom"), children: createElement("main", null, "content") }));
    expect(html).toContain("side");
    expect(html).toContain("bottom");
    expect(html).toContain("content");
    expect(html).toContain("shell-safe-area");
  });
  it("composes manager and portal shells without owning route data", () => {
    expect(renderToStaticMarkup(createElement(ManagerShell, { sidebar: createElement("aside"), header: createElement("header"), children: createElement("main", null, "manager") }))).toContain("manager");
    expect(renderToStaticMarkup(createElement(PortalShell, { header: createElement("header"), children: createElement("main", null, "portal") }))).toContain("portal");
  });
  it("renders motel switcher and bottom nav as accessible compositions", () => {
    expect(renderToStaticMarkup(createElement(MotelSwitcher, { motels: [MOTEL], selectedId: MOTEL.id, onChange: () => {} }))).toContain('aria-label="Nhà trọ"');
    expect(renderToStaticMarkup(createElement(BottomNav, { children: createElement("a", { href: "/" }, "Trang chủ") }))).toContain("Trang chủ");
  });
  it("renders five destinations per navigation and preserves motel scope", () => {
    const html = renderToStaticMarkup(createElement(Sidebar));
    for (const path of ["/", "/motels", "/rooms", "/renters", "/billing"]) {
      expect(html).toContain(`href="${path}?motel=${MOTEL_WITHOUT_EXTRAS.id}"`);
    }
    expect(html.match(/href=/g)).toHaveLength(10);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-label="Điều hướng chính trên điện thoại"');
  });
  it("uses the URL motel selection and renders labelled account controls", () => {
    const html = renderToStaticMarkup(createElement(TopBar, { manager: MANAGER_ME, motels: [MOTEL, MOTEL_WITHOUT_EXTRAS] }));
    expect(html).toContain('for="motel-selector"');
    expect(html).toContain(`value="${MOTEL_WITHOUT_EXTRAS.id}" selected=""`);
    expect(html).toContain(MANAGER_ME.email);
    expect(html).toContain("Menu phụ");
    expect(html).toContain("Đăng xuất");
    expect(html).toMatch(/<summary[^>]*aria-label="[^"]*Menu phụ[^"]*Tài khoản[^"]*"/);
  });
  it("renders shared page header actions and toast adapter", () => {
    const html = renderToStaticMarkup(createElement(ToastProvider, null, createElement(PageHeader, { title: "Tổng quan", description: "Hôm nay", actions: createElement("button", null, "Tạo") })));
    expect(html).toContain("Tổng quan");
    expect(html).toContain("Hôm nay");
    expect(html).toContain("Tạo");
    expect(html).toContain('aria-live="polite"');
  });
  it("disables the motel selector when no motel exists", () => {
    const html = renderToStaticMarkup(createElement(TopBar, { manager: MANAGER_ME, motels: [] }));
    expect(html).toMatch(/<select[^>]*disabled=""/);
    expect(html).toContain("Chưa có nhà trọ");
  });
});
