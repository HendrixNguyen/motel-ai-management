"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type InputHTMLAttributes } from "react";
import Field from "./field";
import ImagePreview from "./image-preview";
const DEFAULT_ACCEPTED = ["image/jpeg", "image/png"];
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type" | "accept" | "onChange" | "onError"> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  maxBytes?: number;
  accept?: string;
  onFiles: (files: File[]) => void;
  onError?: (message: string) => void;
  onRetry?: () => void;
  pending?: boolean;
  retry?: boolean;
  previewUrl?: string;
  onRemovePreview?: () => void;
};

function formatLimit(bytes: number): string {
  return bytes % (1024 * 1024) === 0 ? `${bytes / (1024 * 1024)} MiB` : `${Math.round(bytes / 1_000_000)} MB`;
}

function isAcceptedFile(file: File, maxBytes = 10 * 1024 * 1024, accepted = DEFAULT_ACCEPTED): boolean {
  return (accepted as readonly string[]).includes(file.type) && file.size > 0 && file.size <= maxBytes;
}

function FileUpload({ id, label, error, hint, maxBytes = 10 * 1024 * 1024, accept = DEFAULT_ACCEPTED.join(","), onFiles, onError, onRetry, pending = false, retry, previewUrl, onRemovePreview, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const limit = formatLimit(maxBytes);
  const allowed = accept ? accept.split(",").map((item) => item.trim()) : DEFAULT_ACCEPTED;

  const handleFiles = (files: File[]) => {
    if (files.length !== 1) {
      onError?.("Chọn một ảnh cho mỗi trường tải lên");
      return;
    }
    if (!isAcceptedFile(files[0]!, maxBytes, allowed)) {
      onError?.(accept === DEFAULT_ACCEPTED.join(",") ? `Chỉ nhận ảnh JPEG hoặc PNG tối đa ${limit}` : `Chỉ nhận ảnh được hỗ trợ tối đa ${limit}`);
      return;
    }
    onError?.("");
    onFiles(files);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (pending || !Array.from(event.dataTransfer.types).includes("Files")) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (Array.from(event.dataTransfer.types).includes("Files")) event.preventDefault();
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!pending) handleFiles(Array.from(event.dataTransfer.files));
  };

  return <Field id={id} label={label} hint={hint ?? `Ảnh JPEG hoặc PNG, tối đa ${limit}`} error={error}>
    {(control) => <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-card border-2 border-dashed p-3 transition-colors ${dragging ? "border-primary bg-canvas" : "border-border-strong"} ${pending ? "opacity-60" : ""}`}
      data-dragging={dragging}
    >
      <input {...control} {...props} id={id} ref={inputRef} type="file" accept={accept} onChange={handleChange} disabled={pending} className="sr-only" />
      {previewUrl && <ImagePreview src={previewUrl} alt={label} onRemove={onRemovePreview} />}
      <p className="text-sm text-text-muted">Kéo thả ảnh vào đây</p>
      <button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className="mt-2 min-h-11 rounded-input border border-border-strong bg-surface px-4 font-semibold text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60">
        {previewUrl ? "Thay ảnh" : "Chọn ảnh"}
      </button>
      {pending && <p aria-live="polite" className="mt-2 text-sm">Đang tải lên…</p>}
      {retry && <button type="button" onClick={onRetry} className="mt-2 min-h-11 px-3 underline">Thử lại</button>}
    </div>}
  </Field>;
}

FileUpload.isAcceptedFile = isAcceptedFile;
export default FileUpload;
