// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test, vi } from "vitest";
import BankPicker from "@/components/manager/bank-picker";

const BIN = "970436";
const BANK_NAME = "Ngân hàng TMCP Ngoại thương Việt Nam";

afterEach(cleanup);

describe("BankPicker", () => {
  test.each(["Vietcombank", "ngoai thuong"])("finds a bank by %s", (query) => {
    render(<BankPicker id="bank" value="" onChange={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Ngân hàng" }), {
      target: { value: query },
    });
    expect(
      within(screen.getByRole("listbox")).getByRole("option", { name: /970436/ }),
    ).toBeVisible();
  });

  test("clears previous bank selection when search changes", () => {
    const onChange = vi.fn();
    render(<BankPicker id="bank" value={BIN} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Ngân hàng" }), {
      target: { value: "VietinBank" },
    });
    expect(onChange).toHaveBeenCalledWith("");
  });

  test("requires a bank when requested", () => {
    render(<BankPicker id="bank" value="" onChange={vi.fn()} required />);
    expect(screen.getByRole("combobox", { name: "Ngân hàng" })).toBeRequired();
  });

  test("keyboard navigation selects the first filtered bank", () => {
    const onChange = vi.fn();
    render(<BankPicker id="bank" value="" onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Ngân hàng" });
    fireEvent.change(input, { target: { value: "Viet" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const activeOptionId = input.getAttribute("aria-activedescendant");
    expect(activeOptionId).not.toBeNull();
    expect(document.getElementById(activeOptionId!)).toHaveTextContent("VietinBank");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("970415");
  });

  test("selecting a bank returns its BIN", () => {
    const onChange = vi.fn();
    render(<BankPicker id="bank" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Ngân hàng" }), {
      target: { value: "Vietcombank" },
    });
    const option = within(screen.getByRole("listbox")).getByRole("option", { name: /970436/ });
    expect(option.tagName).toBe("DIV");
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith(BIN);
  });

  test("confirms selected bank by logo, full name, and BIN", () => {
    render(<BankPicker id="bank" value={BIN} onChange={vi.fn()} />);
    expect(screen.getByText(BANK_NAME)).toBeInTheDocument();
    expect(screen.getByText(`BIN: ${BIN}`)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Logo Vietcombank" })).toHaveAttribute(
      "src",
      expect.stringContaining(encodeURIComponent("https://cdn.vietqr.io/img/VCB.png")),
    );
  });

  test("shows Vietnamese no-result feedback", () => {
    render(<BankPicker id="bank" value="" onChange={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Ngân hàng" }), {
      target: { value: "khong co ngan hang nay" },
    });
    expect(screen.getByText("Không tìm thấy ngân hàng phù hợp")).toBeInTheDocument();
  });

  test("keeps bank identity visible when logo fails to load", () => {
    render(<BankPicker id="bank" value={BIN} onChange={vi.fn()} />);
    fireEvent.error(screen.getByRole("img", { name: "Logo Vietcombank" }));
    expect(screen.getByText("Vietcombank")).toBeInTheDocument();
    expect(screen.getByText(BANK_NAME)).toBeInTheDocument();
  });
});
