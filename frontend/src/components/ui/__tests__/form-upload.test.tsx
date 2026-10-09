import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Field from "../field";
import MoneyField from "../money-field";
import DateField from "../date-field";
import SelectField from "../select-field";
import TextareaField from "../textarea-field";
import FileUpload from "../file-upload";
import ImagePreview from "../image-preview";
import FormErrorSummary from "../form-error-summary";
import { normalizeMoneyInput } from "../money-field";
import { isCalendarDate } from "../date-field";

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

  test("renders calendar date, select, and textarea semantics", () => {
    expect(renderToStaticMarkup(<DateField id="from" label="Từ ngày" value="2026-01-02" onChange={() => {}} />)).toContain('type="date"');
    expect(renderToStaticMarkup(<SelectField id="room" label="Phòng" value="a" onChange={() => {}} options={[{ value: "a", label: "A" }]} />)).toContain('<select');
    expect(renderToStaticMarkup(<TextareaField id="note" label="Ghi chú" value="x" onChange={() => {}} />)).toContain('<textarea');
  });

  test("validates JPEG and PNG, allows exactly 10 MB, rejects larger", () => {
    const onError = () => {};
    const html = renderToStaticMarkup(<FileUpload id="proof" label="Biên lai" onFiles={() => {}} onError={onError} />);
    expect(html).toContain('accept="image/jpeg,image/png"');
    expect(html).not.toContain("storage");
    expect(FileUpload.isAcceptedFile(new File([new Uint8Array(10 * 1024 * 1024)], "a.jpg", { type: "image/jpeg" }))).toBe(true);
    expect(FileUpload.isAcceptedFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "a.png", { type: "image/png" }))).toBe(false);
    expect(FileUpload.isAcceptedFile(new File(["x"], "a.gif", { type: "image/gif" }))).toBe(false);
  });

  test("preview exposes removal and upload pending/retry without object keys", () => {
    const html = renderToStaticMarkup(<ImagePreview src="blob:test" alt="Ảnh" onRemove={() => {}} />);
    expect(html).toContain('aria-label="Xóa ảnh"');
    expect(renderToStaticMarkup(<FileUpload id="proof" label="Biên lai" pending retry onFiles={() => {}} />)).toContain("Thử lại");
    expect(html).not.toContain("objectKey");
  });

  test("rejects invalid money input instead of stripping arbitrary characters", () => {
    expect(normalizeMoneyInput("1.5")).toBeNull();
    expect(normalizeMoneyInput("3.500.000")).toBe("3500000");
  });

  test("validates strict calendar dates", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-01-02")).toBe(true);
  });

  test("renders linked upload error and retry callback contract", () => {
    const html = renderToStaticMarkup(<FileUpload id="proof" label="Biên lai" error="Ảnh không hợp lệ" retry onFiles={() => {}} onRetry={() => {}} />);
    expect(html).toContain('aria-describedby="proof-error"');
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
