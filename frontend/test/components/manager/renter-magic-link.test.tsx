import { fireEvent, render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { JSDOM } from "jsdom";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/lib/renter-magic-link", () => ({
  createMagicLinkSession: () => ({ submit: mocks.submit }),
}));
vi.mock("@/components/ui/copy-button", () => ({
  default: ({ value, label }: { value: string; label: string }) => (
    <button data-copy={value}>{label}</button>
  ),
}));
import RenterMagicLink from "@/components/manager/renter-magic-link";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Node: { configurable: true, value: dom.window.Node },
  Event: { configurable: true, value: dom.window.Event },
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
});

describe("RenterMagicLink UI branches", () => {
  test("creates link and exposes copyable URL", async () => {
    mocks.submit.mockResolvedValue({ ok: true, url: "https://rent.example/one" });
    const view = render(<RenterMagicLink motelId="m" renterId="r" />);
    fireEvent.click(view.getByRole("button", { name: "Tạo magic link" }));
    expect(await view.findByRole("button", { name: "Sao chép magic link" })).toHaveAttribute(
      "data-copy",
      "https://rent.example/one",
    );
    expect(view.getByRole("status")).toHaveTextContent("Đã tạo liên kết");
  });

  test("401 redirects and refreshes without rendering server error", async () => {
    mocks.submit.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });
    const view = render(<RenterMagicLink motelId="m" renterId="r" />);
    fireEvent.click(view.getByRole("button", { name: "Tạo magic link" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(view.queryByRole("alert")).toBeNull();
  });

  test("server failures render actionable alert and retry resets old URL", async () => {
    mocks.submit.mockResolvedValueOnce({ ok: false, status: 503, error: "Dịch vụ chưa sẵn sàng" });
    mocks.submit.mockResolvedValueOnce({ ok: true, url: "https://rent.example/two" });
    const view = render(<RenterMagicLink motelId="m" renterId="r" />);
    fireEvent.click(view.getByRole("button", { name: "Tạo magic link" }));
    expect(await view.findByRole("alert")).toHaveTextContent("Dịch vụ chưa sẵn sàng");
    fireEvent.click(view.getByRole("button", { name: "Tạo magic link" }));
    expect(await view.findByRole("button", { name: "Sao chép magic link" })).toHaveAttribute(
      "data-copy",
      "https://rent.example/two",
    );
    expect(view.queryByRole("alert")).toBeNull();
  });
});
