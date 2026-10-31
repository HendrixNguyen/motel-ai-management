import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { cleanup, configure, fireEvent, render, waitFor } from "@testing-library/react";
import { JSDOM } from "jsdom";
import "@testing-library/jest-dom/vitest";
const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

import Page from "../../src/app/(auth)/admin/managers/page";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window });
Object.defineProperty(globalThis, "document", { configurable: true, value: dom.window.document });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
Object.defineProperty(globalThis, "HTMLElement", {
  configurable: true,
  value: dom.window.HTMLElement,
});
Object.defineProperty(globalThis, "FormData", { configurable: true, value: dom.window.FormData });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  writable: true,
  value: true,
});
configure({ asyncUtilTimeout: 1000 });

if (!dom.window.HTMLDialogElement.prototype.showModal)
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
if (!dom.window.HTMLDialogElement.prototype.close)
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new dom.window.Event("close"));
  };

const account = {
  id: "m1",
  email: "owner@example.vn",
  name: "Owner",
  role: "manager",
  disabledAt: null,
  passwordReady: true,
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

describe("admin manager account actions", () => {
  it("sends the provided password and session CSRF token when creating a manager", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([account]), { headers: { "x-csrf-token": "A".repeat(43) } }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(account), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([account]), { headers: { "x-csrf-token": "A".repeat(43) } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Page />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(view.getAllByText("owner@example.vn").length).toBeGreaterThan(0));
    fireEvent.change(view.getByLabelText("Họ tên"), { target: { value: "New Owner" } });
    fireEvent.change(view.getByLabelText("Email"), { target: { value: "new@example.vn" } });
    fireEvent.change(view.getByLabelText("Mật khẩu"), { target: { value: "secure-password-123" } });
    fireEvent.submit(view.getByRole("button", { name: "Tạo tài khoản" }).closest("form")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [, options] = fetchMock.mock.calls[1]!;
    expect(new Headers((options as RequestInit).headers).get("x-csrf-token")).toBe("A".repeat(43));
    expect(JSON.parse(String((options as RequestInit).body))).toMatchObject({
      email: "new@example.vn",
      name: "New Owner",
      password: "secure-password-123",
    });
  });

  it("updates a manager password on reset", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([account]), { headers: { "x-csrf-token": "A".repeat(43) } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([account]), { headers: { "x-csrf-token": "A".repeat(43) } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([account]), { headers: { "x-csrf-token": "A".repeat(43) } }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([account]), { headers: { "x-csrf-token": "A".repeat(43) } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Page />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(view.getAllByText("owner@example.vn").length).toBeGreaterThan(0));
    fireEvent.click(view.getAllByRole("button", { name: "Đổi mật khẩu" })[0]!);
    const resetForm = view.getByRole("button", { name: "Lưu mật khẩu" }).closest("form")!;
    const resetPasswordInput = resetForm.querySelector("input")!;
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(
      resetPasswordInput,
      "another-secure-password-123",
    );
    await act(async () => {
      fireEvent.input(resetPasswordInput);
    });
    await act(async () => {
      fireEvent.submit(resetForm);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    const resetCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/reset-password"));
    expect(resetCall).toBeDefined();
    const [url, options] = resetCall!;
    expect(url).toContain("/reset-password");
    expect(JSON.parse(String((options as RequestInit).body))).toEqual({
      password: "another-secure-password-123",
    });
    expect(new Headers((options as RequestInit).headers).get("x-csrf-token")).toBe("A".repeat(43));
  });

  it("logs out and redirects to login when logout button is clicked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([account]), { headers: { "x-csrf-token": "A".repeat(43) } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Page />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(view.getAllByText("owner@example.vn").length).toBeGreaterThan(0));
    fireEvent.click(view.getByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/auth/logout");
    expect(mocks.replace).toHaveBeenCalledWith("/login");
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
