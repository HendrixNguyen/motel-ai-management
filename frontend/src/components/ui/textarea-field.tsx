import type { TextareaHTMLAttributes } from "react";
import { Textarea } from "@/components/ui/shadcn/textarea";
import Field from "./field";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "id"> & {
  value: string;
  onChange: (value: string) => void;
  id: string;
  label: string;
  error?: string;
  hint?: string;
};

export default function TextareaField({ value, onChange, ...props }: Props) {
  return (
    <Field {...props}>
      {(control) => (
        <Textarea
          {...control}
          {...props}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}
