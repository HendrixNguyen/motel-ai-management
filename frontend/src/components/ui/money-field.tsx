import type { InputHTMLAttributes } from "react";
import Field from "./field";
import { formatVndPlain, parseVndDigits } from "@/lib/format/vnd";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id"> & { value: string; onChange: (value: string) => void; id: string; label: string; error?: string; hint?: string };

export function normalizeMoneyInput(value: string) { return parseVndDigits(value); }

export default function MoneyField({ value, onChange, ...props }: Props) {
  return <Field {...props}>{(control) => <input {...control} {...props} value={value ? formatVndPlain(value) : ""} inputMode="numeric" onChange={(event) => { const digits = normalizeMoneyInput(event.target.value); if (digits !== null) onChange(digits); }} />}</Field>;
}
