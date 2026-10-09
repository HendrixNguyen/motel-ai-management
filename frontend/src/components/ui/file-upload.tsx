import type { ChangeEvent, InputHTMLAttributes } from "react";
import Field from "./field";

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png"];

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type" | "accept" | "onChange"> & { id: string; label: string; error?: string; onFiles: (files: File[]) => void; onError?: (message: string) => void; onRetry?: () => void; pending?: boolean; retry?: boolean; };

function isAcceptedFile(file: File) { return ACCEPTED.includes(file.type) && file.size <= MAX_SIZE; }

function FileUpload({ id, label, error, onFiles, onError, onRetry, pending, retry, ...props }: Props) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.some((file) => !isAcceptedFile(file))) { onError?.("Chỉ nhận ảnh JPEG hoặc PNG tối đa 10 MB"); return; }
    onFiles(files);
  };
  return <Field id={id} label={label} error={error}>{(control) => <><input {...control} {...props} type="file" accept={ACCEPTED.join(",")} onChange={handleChange} disabled={pending} />{pending && <p aria-live="polite">Đang tải lên…</p>}{retry && <button type="button" onClick={onRetry}>Thử lại</button>}</>}</Field>;
}

FileUpload.isAcceptedFile = isAcceptedFile;
export default FileUpload;
