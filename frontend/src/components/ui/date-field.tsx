import type { InputHTMLAttributes } from "react";
import Field from "./field";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id" | "type"> & { value: string; onChange: (value: string) => void; id: string; label: string; error?: string; hint?: string };

export function isCalendarDate(value: string) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if (!match) return false; const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))); return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]); }

export default function DateField({ value, onChange, ...props }: Props) { return <Field {...props}>{(control) => <input {...control} {...props} type="date" value={value} onChange={(event) => onChange(isCalendarDate(event.target.value) ? event.target.value : "")} />}</Field>; }
