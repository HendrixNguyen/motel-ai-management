import { fireEvent, render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { JSDOM } from "jsdom";

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/lib/login-form", () => ({ authenticateManager: mocks.authenticate }));
import LoginPage from "./page";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/login" });
Object.defineProperties(globalThis, { window: { configurable: true, value: dom.window }, document: { configurable: true, value: dom.window.document }, navigator: { configurable: true, value: dom.window.navigator }, HTMLElement: { configurable: true, value: dom.window.HTMLElement }, Node: { configurable: true, value: dom.window.Node }, Event: { configurable: true, value: dom.window.Event }, MouseEvent: { configurable: true, value: dom.window.MouseEvent }, FormData: { configurable: true, value: dom.window.FormData }, IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true } });
beforeAll(() => { Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, writable: true, value: true }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("Manager login branches", () => {
  test("normalizes email and redirects/refetches after success", async () => {
    mocks.authenticate.mockResolvedValue({ ok: true });
    const view = render(<LoginPage />);
    fireEvent.change(view.getByLabelText("Email"), { target: { value: "  USER@example.test " } });
    fireEvent.change(view.getByLabelText("Mật khẩu"), { target: { value: "secret" } });
    fireEvent.click(view.getByRole("button", { name: "Đăng nhập" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
    expect(mocks.authenticate).toHaveBeenCalledWith({ email: "USER@example.test", password: "secret" });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  test("email and password validation errors focus their corresponding fields", async () => {
    mocks.authenticate.mockResolvedValueOnce({ ok: false, error: "Thiếu email", fields: { email: "Email không hợp lệ" } });
    const view = render(<LoginPage />);
    fireEvent.submit(view.container.querySelector("form")!);
    await waitFor(() => expect(view.getByText("Email không hợp lệ")).toBeInTheDocument());
    expect(document.activeElement).toBe(view.getByLabelText("Email"));
    fireEvent.change(view.getByLabelText("Email"), { target: { value: "user@example.test" } });
    fireEvent.change(view.getByLabelText("Mật khẩu"), { target: { value: "secret" } });
    mocks.authenticate.mockResolvedValueOnce({ ok: false, error: "Sai mật khẩu", fields: { password: "Mật khẩu chưa đúng" } });
    fireEvent.submit(view.container.querySelector("form")!);
    await waitFor(() => expect(view.getByText("Mật khẩu chưa đúng")).toBeInTheDocument());
    expect(document.activeElement).toBe(view.getByLabelText("Mật khẩu"));
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  test("generic authentication failure displays safe alert and resets pending state", async () => {
    mocks.authenticate.mockResolvedValue({ ok: false, error: "Đã xảy ra lỗi hệ thống", fields: {} });
    const view = render(<LoginPage />);
    fireEvent.submit(view.container.querySelector("form")!);
    expect(await view.findByRole("alert")).toHaveTextContent("Đã xảy ra lỗi hệ thống");
    expect(view.getByRole("button", { name: "Đăng nhập" })).not.toBeDisabled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
