import type { InputHTMLAttributes } from "react";
import Field from "./field";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id" | "type"> & { value: string; onChange: (value: string) => void; id: string; label: string; error?: string; hint?: string };

export default function DateField({ value, onChange, ...props }: Props) { return <Field {...props}>{(control) => <input {...control} {...props} type="date" value={value} onChange={(event) => onChange(event.target.value)} />}</Field>; }
