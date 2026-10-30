// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";

afterEach(cleanup);
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => {},
});
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  configurable: true,
  value: () => false,
});
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  configurable: true,
  value: () => {},
});
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  configurable: true,
  value: () => {},
});

describe("Radix Select adapter", () => {
  it("opens with keyboard and selects an option", async () => {
    const onValueChange = vi.fn();
    render(
      <Select defaultValue="one" onValueChange={onValueChange}>
        <SelectTrigger aria-label="Room status">
          <SelectValue>Available</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="one">Available</SelectItem>
          <SelectItem value="two">Occupied</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Available" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const options = screen.getAllByRole("option");
    fireEvent.click(options[1]!);
    expect(onValueChange).toHaveBeenCalledWith("two");
  });
});
