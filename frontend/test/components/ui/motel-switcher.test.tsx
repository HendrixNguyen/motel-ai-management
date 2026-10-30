// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import MotelSwitcher from "@/components/ui/motel-switcher";
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => {},
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
