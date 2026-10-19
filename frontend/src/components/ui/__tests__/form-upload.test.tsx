import { beforeAll, describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { JSDOM } from "jsdom";
import Field from "../field";
import MoneyField from "../money-field";
import SelectField from "../select-field";
import TextareaField from "../textarea-field";
import FileUpload from "../file-upload";
import ImagePreview from "../image-preview";
import FormErrorSummary from "../form-error-summary";
import MoneyFieldControl from "../money-field";
import { normalizeMoneyInput } from "../money-field";
import DateField, { isCalendarDate } from "../date-field";

const uploadDom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.defineProperties(globalThis, { window: { configurable: true, value: uploadDom.window }, document: { configurable: true, value: uploadDom.window.document }, navigator: { configurable: true, value: uploadDom.window.navigator }, HTMLElement: { configurable: true, value: uploadDom.window.HTMLElement }, Node: { configurable: true, value: uploadDom.window.Node }, MouseEvent: { configurable: true, value: uploadDom.window.MouseEvent }, Event: { configurable: true, value: uploadDom.window.Event }, DragEvent: { configurable: true, value: uploadDom.window.MouseEvent }, IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true } });
beforeAll(() => { Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true }); });

 describe("form and upload primitives", () => {
  test("merges described-by and associates label, hint, error", () => {
    const html = renderToStaticMarkup(<Field id="name" label="Tên" hint="Gợi ý" error="Sai" describedBy="external"><input /></Field>);
    expect(html).toContain('for="name"');
    expect(html).toContain('aria-describedby="external name-hint name-error"');
    expect(html).toContain('aria-invalid="true"');
  });

  test("renders VND field with grouped value and numeric input", () => {
    const html = renderToStaticMarkup(<MoneyField id="rent" label="Tiền phòng" value="3500000" onChange={() => {}} />);
    expect(html).toContain('value="3.500.000"');
    expect(html).toContain('inputMode="numeric"');
  });

   test("renders empty money as empty and only emits parseable VND digits", async () => {
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host); const values: string[] = [];
    try {
      await act(async () => root.render(createElement(MoneyFieldControl, { id: "empty-money", label: "Tiền", value: "", onChange: (value: string) => values.push(value), error: "required", hint: "VND" })));
      const input = host.querySelector("input") as HTMLInputElement;
      expect(input.value).toBe("");
      expect(host.textContent).toContain("required");
      expect(normalizeMoneyInput("3.500")).toBe("3500");
      expect(normalizeMoneyInput("abc")).toBeNull();
      await act(async () => fireEvent.change(input, { target: { value: "abc" } }));
      expect(values).toEqual([]);
    } finally { await act(async () => root.unmount()); host.remove(); }
  });

  test("formats money while editing and ignores unparseable keystrokes", async () => {
     const host = document.createElement("div"); document.body.append(host);
     const root = createRoot(host); const values: string[] = [];
     try {
       await act(async () => root.render(createElement(MoneyFieldControl, { id: "rent-control", label: "Tiền phòng", value: "3500000", onChange: (value: string) => values.push(value) })));
       const input = host.querySelector("input") as HTMLInputElement;
        await act(async () => { input.value = "3.600.000"; fireEvent.input(input, { target: { value: "3.600.000" } }); fireEvent.change(input, { target: { value: "3.600.000" } }); });
        expect(normalizeMoneyInput("3.600.000")).toBe("3600000");
        expect(normalizeMoneyInput("3.600.000")).toBe("3600000");
       await act(async () => { input.value = "3,6,0"; input.dispatchEvent(new uploadDom.window.Event("input", { bubbles: true })); input.dispatchEvent(new uploadDom.window.Event("change", { bubbles: true })); });
       expect(values).not.toContain("36");
     } finally { await act(async () => root.unmount()); host.remove(); }
   });

   test("DateField emits valid ISO date and clears invalid calendar input", async () => {
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host); const values: string[] = [];
    try {
      await act(async () => root.render(createElement(DateField, { id: "date", label: "Ngày bắt đầu", value: "2026-03-01", onChange: (value: string) => values.push(value) })));
      const input = host.querySelector("input") as HTMLInputElement;
      expect(input.type).toBe("date");
      expect(isCalendarDate("2026-02-30")).toBe(false);
      expect(isCalendarDate("2026-02-28")).toBe(true);
      expect(values).toEqual([]);
    } finally { await act(async () => root.unmount()); host.remove(); }
  });

  test("renders calendar date, select, and textarea semantics", () => {
    expect(renderToStaticMarkup(<DateField id="from" label="Từ ngày" value="2026-01-02" onChange={() => {}} />)).toContain('type="date"');
    expect(renderToStaticMarkup(<SelectField id="room" label="Phòng" value="a" onChange={() => {}} options={[{ value: "a", label: "A" }]} />)).toContain('<select');
    expect(renderToStaticMarkup(<TextareaField id="note" label="Ghi chú" value="x" onChange={() => {}} />)).toContain('<textarea');
  });

  test("renders upload button and drop area with explicit limit and shared validation", () => {
    const html = renderToStaticMarkup(<FileUpload id="proof" label="Biên lai" maxBytes={5_000_000} onFiles={() => {}} />);
    expect(html).toContain('accept="image/jpeg,image/png"');
    expect(html).toContain("Chọn ảnh");
    expect(html).toContain("Kéo thả ảnh vào đây");
    expect(html).toContain("5 MB");
    expect(FileUpload.isAcceptedFile(new File([new Uint8Array(5_000_000)], "a.jpg", { type: "image/jpeg" }), 5_000_000)).toBe(true);
    expect(FileUpload.isAcceptedFile(new File([new Uint8Array(5_000_001)], "a.png", { type: "image/png" }), 5_000_000)).toBe(false);
    expect(FileUpload.isAcceptedFile(new File(["x"], "a.jpg", { type: "image/jpeg" }), 0)).toBe(false);
    expect(FileUpload.isAcceptedFile(new File(["x"], "a.gif", { type: "image/gif" }), 5_000_000)).toBe(false);
  });

  test("rejects empty, multiple and unsupported selected files and invokes valid file handler", async () => {
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host); const received: File[][] = []; const errors: string[] = [];
    try {
      await act(async () => root.render(createElement(FileUpload, { id: "proof", label: "Biên lai", maxBytes: 5_000_000, onFiles: (files: File[]) => received.push(files), onError: (error: string) => errors.push(error) })));
      const input = host.querySelector('input[type="file"]') as HTMLInputElement;
      const invalid = new File(["x"], "bad.gif", { type: "image/gif" });
      Object.defineProperty(input, "files", { configurable: true, value: [invalid] });
      await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
      expect(errors.at(-1)).toContain("JPEG hoặc PNG");
      expect(received).toHaveLength(0);
      const valid = new File([new Uint8Array([255, 216, 255])], "proof.jpg", { type: "image/jpeg" });
      Object.defineProperty(input, "files", { configurable: true, value: [valid] });
      await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
      expect(received).toEqual([[valid]]);
      expect(errors.at(-1)).toBe("");
    } finally { await act(async () => root.unmount()); host.remove(); }
  });

  test("handles empty picker, pending controls, drag enter/leave, and retry", async () => {
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host); const errors: string[] = []; const retry = vi.fn();
    try {
      await act(async () => root.render(createElement(FileUpload, { id: "proof", label: "Biên lai", pending: true, retry: true, onRetry: retry, onFiles: () => {}, onError: (error: string) => errors.push(error) })));
      const input = host.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input.disabled).toBe(true);
      expect((host.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
      await act(async () => (host.querySelectorAll("button")[1] as HTMLButtonElement).click());
      expect(retry).toHaveBeenCalledOnce();
      expect(errors).toHaveLength(0);
    } finally { await act(async () => root.unmount()); host.remove(); }

    const secondHost = document.createElement("div"); document.body.append(secondHost);
    const secondRoot = createRoot(secondHost);
    try {
      await act(async () => secondRoot.render(createElement(FileUpload, { id: "proof2", label: "Biên lai", onFiles: () => {}, onError: (error: string) => errors.push(error) })));
      const secondInput = secondHost.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(secondInput, "files", { configurable: true, value: [] });
      await act(async () => secondInput.dispatchEvent(new Event("change", { bubbles: true })));
      expect(errors.at(-1)).toContain("Chọn một ảnh");
      const area = secondHost.querySelector("[data-dragging]") as HTMLDivElement;
      const enter = new Event("dragenter", { bubbles: true, cancelable: true });
      Object.defineProperty(enter, "dataTransfer", { value: { types: ["Files"] } });
      await act(async () => area.dispatchEvent(enter));
      expect(area.dataset.dragging).toBe("true");
      const leave = new Event("dragleave", { bubbles: true });
      Object.defineProperty(leave, "dataTransfer", { value: { types: ["Files"] } });
      await act(async () => area.dispatchEvent(leave));
      expect(area.dataset.dragging).toBe("false");
    } finally { await act(async () => secondRoot.unmount()); secondHost.remove(); }
  });

  test("prevents drop navigation and rejects multi-file drop", async () => {
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host); const errors: string[] = []; const received: File[][] = [];
    try {
      await act(async () => root.render(createElement(FileUpload, { id: "proof", label: "Biên lai", onFiles: (files: File[]) => received.push(files), onError: (error: string) => errors.push(error) })));
      const area = host.querySelector("[data-dragging]") as HTMLDivElement;
      const event = new Event("drop", { bubbles: true, cancelable: true }) as DragEvent;
      Object.defineProperties(event, { dataTransfer: { value: { files: [new File(["1"], "one.png", { type: "image/png" }), new File(["2"], "two.png", { type: "image/png" })], types: ["Files"] } } });
      await act(async () => area.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(true);
      expect(errors.at(-1)).toContain("Chọn một ảnh");
      expect(received).toHaveLength(0);
    } finally { await act(async () => root.unmount()); host.remove(); }
  });

  test("preview exposes removal and upload pending/retry without object keys", () => {
    const html = renderToStaticMarkup(<ImagePreview src="blob:test" alt="Ảnh" onRemove={() => {}} />);
    expect(html).toContain('aria-label="Xóa ảnh"');
    expect(renderToStaticMarkup(<FileUpload id="proof" label="Biên lai" pending retry onFiles={() => {}} />)).toContain("Thử lại");
    expect(html).not.toContain("objectKey");
  });

  test("rejects invalid money input instead of stripping arbitrary characters", () => {
    expect(normalizeMoneyInput("1.5")).toBeNull();
    expect(normalizeMoneyInput("")).toBe("");
    expect(normalizeMoneyInput("3.500.000")).toBe("3500000");
  });

  test("validates strict calendar dates", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-01-02")).toBe(true);
  });

  test("renders linked upload error and retry callback contract", () => {
    const html = renderToStaticMarkup(<FileUpload id="proof" label="Biên lai" error="Ảnh không hợp lệ" retry onFiles={() => {}} onRetry={() => {}} />);
    expect(html).toContain('aria-describedby="proof-hint proof-error"');
    expect(html).toContain("Thử lại");
  });

  test("preserves child class and aria props in compatibility mode", () => {
    const html = renderToStaticMarkup(<Field id="name" label="Tên"><input className="custom" aria-label="custom" /></Field>);
    expect(html).toContain("custom");
    expect(html).toContain('aria-label="custom"');
  });

  test("renders error summary as alert", () => {
    expect(renderToStaticMarkup(<FormErrorSummary errors={["Thiếu tên", "Sai ngày"]} />)).toContain('role="alert"');
  });
});
