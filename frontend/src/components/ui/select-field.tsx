import type { SelectHTMLAttributes } from "react";
import Field from "./field";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "id"> & { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; id: string; label: string; error?: string; hint?: string };

export default function SelectField({ options, value, onChange, ...props }: Props) { return <Field {...props}>{(control) => <select {...control} {...props} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}</Field>; }
