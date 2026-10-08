import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Field from "@/components/ui/field";
import Sidebar from "@/components/manager/sidebar";
import TopBar from "@/components/manager/top-bar";
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
  it("disables the motel selector when no motel exists", () => {
    const html = renderToStaticMarkup(createElement(TopBar, { manager: MANAGER_ME, motels: [] }));
    expect(html).toMatch(/<select[^>]*disabled=""/);
    expect(html).toContain("Chưa có nhà trọ");
  });
});
