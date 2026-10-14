import type { TextareaHTMLAttributes } from "react";
import Field from "./field";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "id"> & { value: string; onChange: (value: string) => void; id: string; label: string; error?: string; hint?: string };

export default function TextareaField({ value, onChange, ...props }: Props) { return <Field {...props}>{(control) => <textarea {...control} {...props} value={value} onChange={(event) => onChange(event.target.value)} />}</Field>; }
