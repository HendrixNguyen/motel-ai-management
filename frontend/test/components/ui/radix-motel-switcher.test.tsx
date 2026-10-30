// @vitest-environment jsdom
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(() => cleanup());
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => {},
});
import MotelSwitcher from "@/components/ui/motel-switcher";
import type { MotelResponse } from "@/lib/api/types";

describe("Radix motel selector", () => {
  it("renders options and label even when selected motel is unresolved", () => {
    const onChange = vi.fn();
    render(
      <MotelSwitcher
        motels={[{ id: "motel-a", name: "Nhà trọ A", address: "Địa chỉ" } as MotelResponse]}
        selectedId="motel-missing"
        onChange={onChange}
      />,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Chọn nhà trọ");
    fireEvent.click(trigger);
    expect(screen.getByRole("option", { name: "Nhà trọ A" })).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
  });
});
