import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { JSDOM } from "jsdom";
import MotelSwitcher from "@/components/ui/motel-switcher";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Node: { configurable: true, value: dom.window.Node },
  Event: { configurable: true, value: dom.window.Event },
  MouseEvent: { configurable: true, value: dom.window.MouseEvent },
  KeyboardEvent: { configurable: true, value: dom.window.KeyboardEvent },
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
  vi.clearAllMocks();
});
const motels = [
  { id: "m1", name: "Nhà Một" },
  { id: "m2", name: "Nhà Hai" },
] as never[];
describe("MotelSwitcher", () => {
  test("renders current selection and reports selected motel IDs", () => {
    const onChange = vi.fn();
    const view = render(<MotelSwitcher motels={motels} selectedId="m1" onChange={onChange} />);
    expect(view.getByRole("combobox", { name: "Nhà trọ" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    fireEvent.click(view.getByRole("combobox", { name: "Nhà trọ" }));
    fireEvent.click(view.getByRole("option", { name: "Nhà Hai" }));
    expect(onChange).toHaveBeenCalledWith("m2");
  });
  test("renders empty-state placeholder and disables unavailable selector", () => {
    const view = render(<MotelSwitcher motels={[]} onChange={vi.fn()} />);
    expect(view.getByRole("combobox", { name: "Nhà trọ" })).toBeDisabled();
  });
  test("respects caller disabled state", () => {
    const view = render(
      <MotelSwitcher motels={motels} selectedId="m1" disabled onChange={vi.fn()} />,
    );
    expect(view.getByRole("combobox", { name: "Nhà trọ" })).toBeDisabled();
  });
});
