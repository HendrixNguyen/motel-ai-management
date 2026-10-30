import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";
import type { MotelResponse } from "@/lib/api/types";

export default function MotelSwitcher({
  motels,
  selectedId,
  onChange,
  disabled = false,
}: {
  motels: MotelResponse[];
  selectedId?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options = motels.map((motel) => ({ value: motel.id, label: motel.name }));
  const placeholder = motels.length ? "Chọn nhà trọ" : "Chưa có nhà trọ";
  const selected = options.find((option) => option.value === selectedId);
  return (
    <div className="min-w-0">
      <span className="sr-only">Nhà trọ</span>
      <Select
        open={open}
        onOpenChange={setOpen}
        value={selected?.value}
        disabled={!motels.length || disabled}
        onValueChange={onChange}
      >
        <label htmlFor="motel-selector-button" className="sr-only">
          Nhà trọ
        </label>
        <SelectTrigger id="motel-selector-button" aria-label="Nhà trọ">
          <SelectValue
            placeholder={selectedId && !selected ? placeholder : (selected?.label ?? placeholder)}
          >
            {selected?.label ?? placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} textValue={option.label}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
