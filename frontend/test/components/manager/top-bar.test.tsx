import { fireEvent, render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { JSDOM } from "jsdom";
import TopBar from "@/components/manager/top-bar";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  pathname: "/",
  params: new URLSearchParams("motel=m1"),
  captureLogout: false,
  captureSwitch: false,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
  usePathname: () => mocks.pathname,
  useSearchParams: () => mocks.params,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api/auth.client", () => ({ logout: mocks.logout }));
vi.mock("@/components/manager/capture-queue-warning", () => ({
  default: () => <p>Queue warning</p>,
}));
vi.mock("@/components/ui/theme-select", () => ({ default: () => <button>Theme</button> }));
vi.mock("@/components/ui/motel-switcher", () => ({
  default: ({
    motels,
    onChange,
  }: {
    motels: Array<{ id: string; name: string }>;
    onChange: (id: string) => void;
  }) => (
    <select aria-label="Nhà trọ" onChange={(event) => onChange(event.target.value)}>
      {motels.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  ),
}));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Node: { configurable: true, value: dom.window.Node },
  Event: { configurable: true, value: dom.window.Event },
  CustomEvent: { configurable: true, value: dom.window.CustomEvent },
  MouseEvent: { configurable: true, value: dom.window.MouseEvent },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
});
beforeAll(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    writable: true,
    value: true,
  });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  mocks.params = new URLSearchParams("motel=m1");
  mocks.captureLogout = false;
  mocks.captureSwitch = false;
});
const manager = { id: "manager", email: "manager@example.test" } as never;
const motels = [
  { id: "m1", name: "Nhà A" },
  { id: "m2", name: "Nhà B" },
] as never[];

describe("TopBar branch behavior", () => {
  test("renders the deployed build SHA and timestamp", () => {
    const view = render(<TopBar manager={manager} motels={motels} />);
    expect(view.getByTestId("build-version").textContent).toContain("Build");
    expect(view.getByTestId("build-version").textContent).toContain("·");
  });

  test("selecting a motel routes with current page/search and dispatches switch event", async () => {
    render(<TopBar manager={manager} motels={motels} />);
    fireEvent.change(document.querySelector("select")!, { target: { value: "m2" } });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/?motel=m2"));
  });

  test("capture queue cancellation prevents logout and clears pending", async () => {
    window.addEventListener("capture:logout", (event) => event.preventDefault(), { once: true });
    const view = render(<TopBar manager={manager} motels={motels} />);
    fireEvent.click(view.getByLabelText("Menu phụ, Tài khoản"));
    fireEvent.click(view.getByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => expect(mocks.logout).not.toHaveBeenCalled());
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(view.getByRole("button", { name: "Đăng xuất" })).not.toBeDisabled();
  });

  test("account menu does not duplicate the Contracts destination", async () => {
    const view = render(<TopBar manager={manager} motels={motels} />);
    fireEvent.click(view.getByLabelText("Menu phụ, Tài khoản"));
    expect(view.queryByRole("link", { name: "Hợp đồng" })).toBeNull();
  });

  test("account menu closes on outside pointer interaction", async () => {
    const view = render(<TopBar manager={manager} motels={motels} />);
    const trigger = view.getByLabelText("Menu phụ, Tài khoản");
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  test("account menu closes on Escape and returns focus to trigger", async () => {
    const view = render(<TopBar manager={manager} motels={motels} />);
    const trigger = view.getByLabelText("Menu phụ, Tài khoản");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document.querySelector("#manager-account-menu")!, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(trigger).toHaveFocus();
  });

  test("logout success redirects and refreshes; API error stays visible", async () => {
    const view = render(<TopBar manager={manager} motels={motels} />);
    fireEvent.click(view.getByLabelText("Menu phụ, Tài khoản"));
    mocks.logout.mockResolvedValueOnce(undefined);
    fireEvent.click(view.getByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
    expect(mocks.refresh).toHaveBeenCalled();
    mocks.logout.mockRejectedValueOnce(new Error("failure"));
    fireEvent.click(view.getByRole("button", { name: "Đăng xuất" }));
    expect(await view.findByRole("alert")).toBeInTheDocument();
  });
});
